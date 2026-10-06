/** The Nigerian state each Vendo city is in. A city not listed here is shown under its own name. */
const stateOfCity: Record<string, string> = { Kaduna: "Kaduna State", Abuja: "Federal Capital Territory (Abuja)", Kano: "Kano State", Lagos: "Lagos State" };
export const stateOf = (cityName: string) => stateOfCity[cityName] ?? cityName;
