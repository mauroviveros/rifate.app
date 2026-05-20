import { formatCurrency } from "@/lib/formatters"
import { Button } from "@shadcn/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@shadcn/dialog"
import { RaffleBuyerSellForm } from "../forms/raffleBuyerSellForm"

export function RaffleBuyerSellDialog(
  {
    selectedNumbers = [],
    price = 0,
  }: {
    selectedNumbers?: number[]
    price?: number
  }
){

  const sellTitle = `Vender ${selectedNumbers.length} número${selectedNumbers.length !== 1 ? 's' : ''}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
            size="lg"
            className="w-full rounded-xl h-12 font-bold text-base shadow-float"
          >
            {sellTitle} - {formatCurrency(selectedNumbers.length * price)}
          </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            className="tracking-tight text-lg font-extrabold"
          >
            {sellTitle}
          </DialogTitle>
          <div className="flex flex-wrap gap-1.5 py-2">
            {selectedNumbers.map((number) => (
              <span key={number} className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-lg">
                {String(number).padStart(2, "0")}
              </span>
            ))}
          </div>

          <RaffleBuyerSellForm />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
