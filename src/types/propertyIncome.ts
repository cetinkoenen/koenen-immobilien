import type { PropertyIncome as FinancePropertyIncome } from "./finance";

export type PropertyIncome = FinancePropertyIncome;

export type CreatePropertyIncomeInput = {
  propertyId: string;
  annualRent: number;
  otherIncome: number;
};

export type UpdatePropertyIncomeInput = {
  annualRent?: number;
  otherIncome?: number;
};