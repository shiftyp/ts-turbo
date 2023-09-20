import resolve from "@rollup/plugin-node-resolve"
import typescript from "@rollup/plugin-typescript"

import { version } from "./package.json"
const year = new Date().getFullYear()
const banner = `/*!\nTurbo ${version}\nCopyright © ${year} 37signals LLC\nCopyright © ${year} Ryan Kahn\n*/`

export default [
  {
    input: "src/index.ts",
    output: [
      {
        name: "Turbo",
        file: "dist/turbo.es2017-umd.js",
        format: "umd",
        banner,
        sourcemap: !process.env.CI
      },
      {
        file: "dist/turbo.es2017-esm.js",
        format: "es",
        banner,
        sourcemap: !process.env.CI
      }
    ],
    plugins: [
      resolve(),
      typescript()
    ],
    watch: {
      include: "src/**"
    }
  }
]
