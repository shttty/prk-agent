

export interface ModelCatalog {
 readonly models: readonly {
  readonly value: string;
  readonly label: string;
  readonly provider: string;
  readonly thinkingLevels: readonly string[];
  readonly contextWindow: number;
 }[];
 readonly defaultModel: string;
 readonly defaultThinkingLevel: string;
}
