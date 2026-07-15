import{act,renderHook}from"@testing-library/react";
import type{MockedFunction}from"vitest";
import{afterEach,beforeEach,describe,expect,it,vi}from"vitest";
import{useQuery}from"../src/hooks/useQuery";
describe("useQuery",()=>{
  let fetchMock:MockedFunction<typeof fetch>;
  beforeEach(()=>{fetchMock=vi.fn<typeof fetch>();vi.stubGlobal("fetch",fetchMock)});
  afterEach(()=>vi.unstubAllGlobals());
  it("stores success",async()=>{
    fetchMock.mockResolvedValue(new Response(JSON.stringify({response:"Cached",cache_hit:true,similarity_score:.97,latency_ms:4}),{status:200}));
    const{result}=renderHook(()=>useQuery());
    await act(async()=>{expect(await result.current.submit("Hello")).toBe(true)});
    expect(result.current.state.status).toBe("success");
  });
});
