# ./backend/app/pvlib_tools/pvlib_engine.py
"""This file contains the PVLibEngine class which encapsulates pvlib Location, PVSystem, and ModelChain
creation and simulation into a single reusable object."""

from typing import NamedTuple
import pandas as pd
from pvlib.location import Location
from pvlib.pvsystem import PVSystem
from pvlib.modelchain import ModelChain
from app.core.logger import alogger
from app.schemas.pvlib_engine_schema import PVLibEngineInputSchema
from app.pvlib_tools.create_location import create_location
from app.pvlib_tools.create_pvsystem import create_pvsystem

class ModelChainResult(NamedTuple):
    """Container for ModelChain simulation results."""
    ac: pd.Series
    dc: pd.DataFrame | pd.Series
    total_irrad: pd.DataFrame | list
    weather: pd.DataFrame
    modelchain: ModelChain


class PVLibEngine:
    """Reusable PV simulation engine that wraps pvlib Location, PVSystem, and ModelChain.

    The Location and PVSystem objects are built once at initialization and reused
    across multiple simulation runs. A fresh ModelChain is created for each run()
    call because pvlib ModelChain stores simulation results as internal state.

    Usage:
        engine = PVLibEngine(input_schema)
        result = engine.run(weather_df)
        print(result.ac)
    """

    def __init__(self, input_schema: PVLibEngineInputSchema) -> None:
        """Initializes the PVLibEngine from a validated PVLibEngineInputSchema.

        Args:
            input_schema: Validated input schema containing location, pvsystem,
                          and optional modelchain configuration.
        """
        alogger.debug("Initializing PVLibEngine with input schema: %s", input_schema)

        self._location: Location = create_location(input_schema.location)
        alogger.debug("PVLibEngine: Location created — %s", self._location)

        self._system: PVSystem = create_pvsystem(input_schema.pvsystem)
        alogger.debug("PVLibEngine: PVSystem created — %s", self._system)

        self._mc_config: dict = {}
        if input_schema.modelchain_config is not None:
            self._mc_config = input_schema.modelchain_config.model_dump(exclude_none=True)
            alogger.debug("PVLibEngine: ModelChain config overrides — %s", self._mc_config)
        else:
            alogger.debug("PVLibEngine: No ModelChain config overrides, pvlib defaults will be used")

        alogger.info("PVLibEngine initialized successfully")

    @property
    def location(self) -> Location:
        """Returns the pvlib Location object."""
        return self._location

    @property
    def system(self) -> PVSystem:
        """Returns the pvlib PVSystem object."""
        return self._system

    def _build_modelchain(self) -> ModelChain:
        """Builds a fresh ModelChain from the stored system, location, and config.

        A new ModelChain is created each time because pvlib ModelChain.run_model()
        mutates internal state (stores results on mc.results). Reusing the same
        ModelChain with different weather data can produce stale/mixed results.
        """
        alogger.debug("Building fresh ModelChain with config: %s", self._mc_config)

        mc = ModelChain(
            system=self._system,
            location=self._location,
            **self._mc_config
        )

        alogger.debug("ModelChain built successfully: %s", mc)
        return mc

    def simulate(self, weather: pd.DataFrame) -> ModelChainResult:
        """Auto-detects the weather data type and runs the appropriate simulation.

        Detection priority (first match wins):
            1. 'effective_irradiance' in columns → run_from_effective_irradiance()
            2. 'poa_global' in columns → run_from_poa()
            3. 'ghi' in columns → run() (standard GHI/DNI/DHI)

        Args:
            weather: A pandas DataFrame with a DatetimeIndex containing one of
                     the supported column sets.

        Returns:
            ModelChainResult from the dispatched run method.

        Raises:
            ValueError: If weather is empty/None or columns don't match any
                        supported irradiance type.
        """
        if weather is None or weather.empty:
            alogger.error("PVLibEngine.simulate() received empty or None weather data")
            raise ValueError("Weather data cannot be empty or None.")

        columns = set(weather.columns)

        if "effective_irradiance" in columns:
            alogger.info("simulate() detected effective_irradiance data — dispatching to run_from_effective_irradiance()")
            return self.run_from_effective_irradiance(weather)

        if "poa_global" in columns:
            alogger.info("simulate() detected POA data — dispatching to run_from_poa()")
            return self.run_from_poa(weather)

        if "ghi" in columns:
            alogger.info("simulate() detected GHI/DNI/DHI data — dispatching to run()")
            return self.run(weather)

        alogger.error(
            "simulate() could not detect irradiance type from columns: %s",
            list(weather.columns),
        )
        raise ValueError(
            f"Cannot detect irradiance type from columns: {list(weather.columns)}. "
            "Expected one of: ['effective_irradiance'], ['poa_global', 'poa_direct', 'poa_diffuse'], or ['ghi', 'dni', 'dhi']."
        )

    def run(self, weather: pd.DataFrame) -> ModelChainResult:
        """Runs a PV simulation with the given weather data.

        Builds a fresh ModelChain, executes run_model(), and returns the results
        as a ModelChainResult NamedTuple.

        Args:
            weather: A pandas DataFrame with a DatetimeIndex and columns expected
                     by pvlib (e.g., 'ghi', 'dni', 'dhi', optionally 'temp_air',
                     'wind_speed').

        Returns:
            ModelChainResult containing ac, dc, total_irrad, weather, and the
            ModelChain object itself.

        Raises:
            ValueError: If weather DataFrame is empty or missing required columns.
        """
        if weather is None or weather.empty:
            alogger.error("PVLibEngine.run() received empty or None weather data")
            raise ValueError("Weather data cannot be empty or None.")

        alogger.debug(
            "PVLibEngine.run() called with weather data: shape=%s, columns=%s, index_range=[%s → %s]",
            weather.shape,
            list(weather.columns),
            weather.index.min(),
            weather.index.max(),
        )

        mc = self._build_modelchain()

        alogger.debug("Running ModelChain.run_model() with provided weather data")
        mc.run_model(weather)
        alogger.info(
            "PVLibEngine simulation completed — weather rows=%d, ac_energy_sum=%.2f",
            len(weather),
            mc.results.ac.sum() if mc.results.ac is not None else 0.0,
        )

        result = ModelChainResult(
            ac=mc.results.ac,
            dc=mc.results.dc,
            total_irrad=mc.results.total_irrad,
            weather=weather,
            modelchain=mc,
        )

        alogger.debug("ModelChainResult assembled successfully")
        return result

    def run_from_poa(self, weather: pd.DataFrame) -> ModelChainResult:
        """Runs a PV simulation from plane-of-array (POA) irradiance data.

        Builds a fresh ModelChain, executes run_model_from_poa(), and returns
        the results. Use this when weather data already contains POA irradiance
        components (e.g., from PVGIS hourly responses).

        Args:
            weather: A pandas DataFrame with a DatetimeIndex and columns:
                     'poa_global', 'poa_direct', 'poa_diffuse', and optionally
                     'temp_air', 'wind_speed'.

        Returns:
            ModelChainResult containing ac, dc, total_irrad, weather, and the
            ModelChain object itself.

        Raises:
            ValueError: If weather DataFrame is empty or None.
        """
        if weather is None or weather.empty:
            alogger.error("PVLibEngine.run_from_poa() received empty or None weather data")
            raise ValueError("Weather data cannot be empty or None.")

        alogger.debug(
            "PVLibEngine.run_from_poa() called with weather data: shape=%s, columns=%s, index_range=[%s → %s]",
            weather.shape,
            list(weather.columns),
            weather.index.min(),
            weather.index.max(),
        )

        mc = self._build_modelchain()

        alogger.debug("Running ModelChain.run_model_from_poa() with provided weather data")
        mc.run_model_from_poa(weather)
        alogger.info(
            "PVLibEngine POA simulation completed — weather rows=%d, ac_energy_sum=%.2f",
            len(weather),
            mc.results.ac.sum() if mc.results.ac is not None else 0.0,
        )

        result = ModelChainResult(
            ac=mc.results.ac,
            dc=mc.results.dc,
            total_irrad=mc.results.total_irrad,
            weather=weather,
            modelchain=mc,
        )

        alogger.debug("ModelChainResult assembled successfully")
        return result

    def run_from_effective_irradiance(self, weather: pd.DataFrame) -> ModelChainResult:
        """Runs a PV simulation from pre-computed effective irradiance data.

        Builds a fresh ModelChain, executes run_model_from_effective_irradiance(),
        and returns the results. Use this when effective irradiance has already
        been calculated externally.

        Args:
            weather: A pandas DataFrame with a DatetimeIndex and a column
                     'effective_irradiance', and optionally 'temp_air',
                     'wind_speed'.

        Returns:
            ModelChainResult containing ac, dc, total_irrad, weather, and the
            ModelChain object itself.

        Raises:
            ValueError: If weather DataFrame is empty or None.
        """
        if weather is None or weather.empty:
            alogger.error("PVLibEngine.run_from_effective_irradiance() received empty or None weather data")
            raise ValueError("Weather data cannot be empty or None.")

        alogger.debug(
            "PVLibEngine.run_from_effective_irradiance() called with weather data: shape=%s, columns=%s, index_range=[%s → %s]",
            weather.shape,
            list(weather.columns),
            weather.index.min(),
            weather.index.max(),
        )

        mc = self._build_modelchain()

        alogger.debug("Running ModelChain.run_model_from_effective_irradiance() with provided weather data")
        mc.run_model_from_effective_irradiance(weather)
        alogger.info(
            "PVLibEngine effective irradiance simulation completed — weather rows=%d, ac_energy_sum=%.2f",
            len(weather),
            mc.results.ac.sum() if mc.results.ac is not None else 0.0,
        )

        result = ModelChainResult(
            ac=mc.results.ac,
            dc=mc.results.dc,
            total_irrad=mc.results.total_irrad,
            weather=weather,
            modelchain=mc,
        )

        alogger.debug("ModelChainResult assembled successfully")
        return result
