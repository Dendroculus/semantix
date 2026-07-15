import json
from collections.abc import Callable, Sequence
from typing import cast
from urllib.parse import quote
import httpx
import numpy as np
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_random_exponential
from app.core.exceptions import InvalidProviderResponseError, ProviderAuthenticationError, ProviderRequestError, ProviderRetryableError
from app.models.schemas import EMBEDDING_DIMENSIONS

RetryFactory = Callable[[], AsyncRetrying]
def default_retry_factory() -> AsyncRetrying:
    return AsyncRetrying(retry=retry_if_exception_type(ProviderRetryableError),stop=stop_after_attempt(3),wait=wait_random_exponential(multiplier=0.5,max=4),reraise=True)
def _vector(value: object) -> list[float] | None:
    if not isinstance(value,list) or len(value)!=EMBEDDING_DIMENSIONS or not all(isinstance(v,(int,float)) and not isinstance(v,bool) for v in value):
        return None
    return [float(cast(int|float,v)) for v in value]
def _rows(value: object) -> list[list[float]] | None:
    direct=_vector(value)
    if direct is not None: return [direct]
    if not isinstance(value,list) or not value: return None
    if len(value)==1:
        nested=_rows(value[0])
        if nested is not None: return nested
    result=[]
    for item in value:
        row=_vector(item)
        if row is None: return None
        result.append(row)
    return result or None

class HuggingFaceService:
    def __init__(self,client:httpx.AsyncClient,api_key:str,base_url:str,embedding_model:str,generation_model:str,max_new_tokens:int,retry_factory:RetryFactory=default_retry_factory)->None:
        self._client,self._api_key,self._base_url=client,api_key,base_url.rstrip("/")
        self._embedding_model,self._generation_model=embedding_model,generation_model
        self._max_new_tokens,self._retry_factory=max_new_tokens,retry_factory
    async def create_embedding(self,text:str)->Sequence[float]:
        rows=_rows(await self._post(self._embedding_model,{"inputs":text,"options":{"wait_for_model":True}}))
        if rows is None: raise InvalidProviderResponseError("Invalid embedding shape")
        vector=np.mean(np.asarray(rows,dtype=np.float64),axis=0)
        if vector.shape!=(EMBEDDING_DIMENSIONS,): raise InvalidProviderResponseError("Invalid embedding dimensions")
        return [float(v) for v in vector]
    async def generate(self,prompt:str)->str:
        payload=await self._post(self._generation_model,{"inputs":prompt,"parameters":{"max_new_tokens":self._max_new_tokens,"return_full_text":False},"options":{"wait_for_model":True}})
        value: object = payload[0].get("generated_text") if isinstance(payload,list) and payload and isinstance(payload[0],dict) else payload.get("generated_text") if isinstance(payload,dict) else None
        if not isinstance(value,str) or not value.strip(): raise InvalidProviderResponseError("Invalid generation response")
        return value.strip()
    async def _post(self,model:str,body:dict[str,object])->object:
        async for attempt in self._retry_factory():
            with attempt: return await self._once(model,body)
        raise ProviderRetryableError("Retry policy ended")
    async def _once(self,model:str,body:dict[str,object])->object:
        try:
            response=await self._client.post(f"{self._base_url}/{quote(model,safe='/')}",headers={"Authorization":f"Bearer {self._api_key}","Content-Type":"application/json"},json=body)
        except httpx.RequestError as exc:
            raise ProviderRetryableError("Network failure") from exc
        if response.status_code==429 or response.status_code>=500: raise ProviderRetryableError(f"Retryable status {response.status_code}")
        if response.status_code in {401,403}: raise ProviderAuthenticationError("Credentials rejected")
        if response.status_code>=400: raise ProviderRequestError(f"Provider status {response.status_code}")
        try: return cast(object,json.loads(response.text))
        except json.JSONDecodeError as exc: raise InvalidProviderResponseError("Malformed JSON") from exc
