import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator


def today():
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def date_allowed(value: date):
    if value > today():
        raise ValueError("A execução não pode estar no futuro.")
    return value


def decimal_text(value: str, places=6):
    if (
        not isinstance(value, str)
        or len(value) > 30
        or not re.fullmatch(rf"\d+(\.\d{{1,{places}}})?", value)
    ):
        raise ValueError(f"Informe decimal em texto, com ponto e até {places} casas.")
    if Decimal(value) > Decimal("999999999999.999999"):
        raise ValueError("Quantidade excede o limite de armazenamento.")
    return value


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class EntryBase(Input):
    scope_item_id: str = Field(min_length=1, max_length=100)
    expected_version: StrictInt = Field(ge=1)


class PercentageEntry(EntryBase):
    measurement_type: Literal["percentage"]
    daily_percentage: str

    @field_validator("daily_percentage")
    @classmethod
    def percentage(cls, value):
        decimal_text(value, 2)
        if not 0 < Decimal(value) <= 100:
            raise ValueError("Percentual deve ser maior que zero e até 100.")
        return value


class UnitEntry(EntryBase):
    measurement_type: Literal["unit"]
    completed: StrictBool

    @field_validator("completed")
    @classmethod
    def completed_true(cls, value):
        if not value:
            raise ValueError("Marque somente unidades executadas.")
        return value


Entry = Annotated[PercentageEntry | UnitEntry, Field(discriminator="measurement_type")]


class ProductionBatch(Input):
    execution_date: date
    observation: str = Field(default="", max_length=1000)
    entries: list[Entry] = Field(min_length=1, max_length=200)
    _date = field_validator("execution_date")(date_allowed)

    @field_validator("entries")
    @classmethod
    def unique_items(cls, entries):
        if len({entry.scope_item_id for entry in entries}) != len(entries):
            raise ValueError("Não repita elementos no lote.")
        return entries


class Correction(Input):
    quantity: str
    reason: str = Field(min_length=5, max_length=1000)
    expected_record_version: StrictInt = Field(ge=1)
    expected_scope_version: StrictInt = Field(ge=1)

    @field_validator("quantity")
    @classmethod
    def quantity_text(cls, value):
        return decimal_text(value)

    @field_validator("reason")
    @classmethod
    def reason_text(cls, value):
        if len(value.strip()) < 5:
            raise ValueError("Informe uma justificativa com ao menos cinco caracteres.")
        return value.strip()


class WorkforceInput(Input):
    headcount: StrictInt = Field(ge=0, le=100000)
    observation: str = Field(default="", max_length=1000)
    expected_version: StrictInt | None = Field(default=None, ge=1)
