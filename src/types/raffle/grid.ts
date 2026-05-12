export type RaffleNumberStatus = "AVAILABLE" | "SOLD" | "SELECTED"

export interface RaffleGridState {
  length: number
  soldNumbers: number[]
  selectedNumbers: number[]
  availableNumbers: number[]
  hasSelection: boolean
  soldCount: number
  selectedCount: number
  availableCount: number
}

export interface RaffleGridHookProps {
  length: number
  editable?: boolean
  soldNumbers?: number[]
  selectedNumbers?: number[]
  defaultSelectedNumbers?: number[]
  onSelectionChange?: (selectedNumbers: number[]) => void
  onStateChange?: (state: RaffleGridState) => void
}

export interface RaffleGridHookResult {
  state: RaffleGridState
  toggleNumber: (number: number) => void
  clearSelection: () => void
  setSelection: (numbers: number[]) => void
  isSold: (number: number) => boolean
  isSelected: (number: number) => boolean
}
