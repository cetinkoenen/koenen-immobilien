export type PropertyIncome = {
  id: string;
  propertyId: string;
  annualRent: number;
  otherIncome: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePropertyIncomeInput = {
  propertyId: string;
  annualRent: number;
  otherIncome: number;
};

export type UpdatePropertyIncomeInput = {
  annualRent?: number;
  otherIncome?: number;
};