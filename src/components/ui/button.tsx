import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-foreground text-background shadow-xs hover:opacity-90 active:opacity-100",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/80 hover:bg-secondary/80 hover:border-border",
        outline:
          "border border-border/90 bg-transparent text-foreground hover:bg-muted/60 hover:border-foreground/20",
        ghost:
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        destructive:
          "bg-destructive/15 text-destructive border border-destructive/25 hover:bg-destructive/25 hover:border-destructive/40",
        link: "text-foreground underline-offset-4 hover:underline p-0 h-auto font-normal",
      },
      size: {
        default: "h-8 gap-1.5 px-3 rounded-md text-xs",
        xs: "h-6 gap-1 rounded px-2 text-[0.72rem] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-2 rounded-lg px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-8 rounded-md p-0",
        "icon-xs": "size-6 rounded p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md p-0 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9 rounded-lg p-0 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
