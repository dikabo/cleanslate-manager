import { ExpenseAllocationScope, ExpenseCategory } from "@/types";

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  fixed: "Charge fixe",
  variable: "Charge variable",
};

export const expenseAllocationScopeLabels: Record<ExpenseAllocationScope, string> = {
  order: "Commande",
  day: "Journee",
  week: "Semaine",
  month: "Mois",
  period: "Periode",
};
