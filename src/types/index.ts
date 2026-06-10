export * from "./database";
export * from "./raffle";

export interface Stats {
  name: string;
  value: string;
  icon: string;
  highlight?: "default" | "accent" | "primary";
}
