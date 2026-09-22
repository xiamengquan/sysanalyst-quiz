import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium tracking-wide transition-colors duration-150 leading-none",
  {
    variants: {
      variant: {
        default:
          "border-border/80 bg-secondary text-secondary-foreground hover:bg-secondary/90",
        secondary:
          "border-transparent bg-muted text-muted-foreground",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive",
        outline:
          "border-border/90 bg-transparent text-foreground",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
