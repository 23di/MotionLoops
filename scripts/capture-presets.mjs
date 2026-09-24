import {build} from "esbuild";
import {writeFileSync} from "node:fs";

const result=await build({entryPoints:["src/preset-visual-capture.ts"],bundle:true,write:false,
  platform:"node",format:"esm"});
const module=await import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64"));
const output=process.argv[2]??"/tmp/orbit-preset-baseline.json";
const traces=module.capturePresetVisuals();
writeFileSync(output,JSON.stringify(traces));
console.log(`${Object.keys(traces).length} preset traces saved to ${output}`);
