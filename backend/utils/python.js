import { spawn } from "node:child_process";
export function runPython(args = [], opts = {}) {
  const pythonBin = process.env.PYTHON_BIN || "python";
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "", err = "";
    child.stdout.on("data", d => out += d.toString());
    child.stderr.on("data", d => err += d.toString());
    child.on("close", code => {
      if (code === 0) resolve({ code, out, err });
      else reject(new Error(err || out || `python exited ${code}`));
    });
  });
}
