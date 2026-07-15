function requiredUrl(value:string|undefined,name:string):string{
  if(value===undefined||value.trim()==="")throw new Error(name+" must be configured");
  const normalized=value.trim().replace(/\/+$/,"");
  const parsed=new URL(normalized);
  if(!["http:","https:"].includes(parsed.protocol))throw new Error(name+" must use HTTP or HTTPS");
  return normalized;
}
export const API_BASE_URL=requiredUrl(import.meta.env.VITE_API_BASE_URL,"VITE_API_BASE_URL");
