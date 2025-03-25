import { drive, DriveConfig } from "./drive"
import { forms } from "./forms"

export interface Config {
  drive: DriveConfig
  forms: typeof forms
}

export const config: Config = {
  drive,
  forms
}
