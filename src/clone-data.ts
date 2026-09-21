/** Clone plain settings data without browser-only APIs (Figma's sandbox). */
export function cloneData<T>(value:T):T {
  if(Array.isArray(value))return value.map(item=>cloneData(item)) as T;
  if(value!==null&&typeof value==="object")return Object.fromEntries(
    Object.entries(value).map(([key,item])=>[key,cloneData(item)]),
  ) as T;
  return value;
}
