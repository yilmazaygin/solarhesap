export interface ModuleConfig {
  source: "database" | "manual";
  db_name: string;
  module_name: string;
  module_display: string; // display label
  manual_params_json: string;
}

export interface TempConfig {
  source: "lookup" | "manual";
  model: string;
  config: string;
  manual_params_json: string;
}

export interface InverterConfig {
  source: "database" | "manual";
  db_name: string;
  inverter_name: string;
  inverter_display: string;
  manual_params_json: string;
}

export interface ArrayState {
  id: string;
  name: string;
  surface_tilt: number;
  surface_azimuth: number;
  modules_per_string: number;
  strings: number;
  module_type: string;
  albedo: string;
  module: ModuleConfig;
  temperature_model: TempConfig;
}

export function defaultModuleConfig(): ModuleConfig {
  return {
    source: "database",
    db_name: "CECMod",
    module_name: "",
    module_display: "",
    manual_params_json: '{"pdc0": 250, "gamma_pdc": -0.004}',
  };
}

export const DEFAULT_FLAT_MODULE: ModuleConfig = {
  source: "database",
  db_name: "CECMod",
  module_name: "Canadian_Solar_Inc__CS6K_300MS",
  module_display: "Canadian Solar CS6K-300MS",
  manual_params_json: '{"pdc0": 300, "gamma_pdc": -0.004}',
};

export const DEFAULT_INVERTER: InverterConfig = {
  source: "database",
  db_name: "CECInverter",
  inverter_name: "Fronius_USA__IG_Plus_3_0_1_UNI__208V_",
  inverter_display: "Fronius IG Plus 3.0 UNI",
  manual_params_json: '{"pdc0": 3000, "eta_inv_nom": 0.96}',
};

export function defaultTempConfig(): TempConfig {
  return {
    source: "lookup",
    model: "sapm",
    config: "open_rack_glass_polymer",
    manual_params_json: '{"a": -3.56, "b": -0.075, "deltaT": 3}',
  };
}

export function defaultArray(id?: string): ArrayState {
  return {
    id: id || String(Date.now()),
    name: "",
    surface_tilt: 30,
    surface_azimuth: 180,
    modules_per_string: 10,
    strings: 2,
    module_type: "glass_polymer",
    albedo: "",
    module: defaultModuleConfig(),
    temperature_model: defaultTempConfig(),
  };
}
