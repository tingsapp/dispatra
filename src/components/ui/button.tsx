import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { LoaderCircle } from "lucide-react"

const buttonVariants = cva(
  "app-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-rose-600 aria-invalid:ring-rose-600/20 dark:aria-invalid:ring-rose-600/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "app-primary bg-slate-900 text-white hover:bg-slate-900/90",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-600/90 focus-visible:ring-rose-600/20 dark:bg-rose-600/60 dark:focus-visible:ring-rose-600/40",
        outline:
          "app-secondary border bg-white hover:bg-slate-100 hover:text-slate-900",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-100/80",
        ghost:
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-100/50",
        link: "text-slate-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5 text-base has-[>svg]:px-6",
        xs: "h-6 gap-1 rounded-full px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-full px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-full px-6 py-2.5 text-base has-[>svg]:px-6",
        icon: "size-9",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ActionButtonProps = Omit<React.ComponentProps<"button">, "onClick"> & {
  asChild?: boolean
  loading?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown
}

/** Native-shaped action control. Returned promises own the loading state automatically. */
function ActionButton({ asChild = false, loading = false, disabled, children, onClick, onClickCapture, ...props }: ActionButtonProps) {
  const [pending, setPending] = React.useState(false)
  const running = React.useRef(false)
  const busy = pending || loading || props["aria-busy"] === true || props["aria-busy"] === "true"
  const Comp = asChild ? Slot : "button"
  const click = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || busy || running.current) { event.preventDefault(); event.stopPropagation(); return }
    const result = onClick?.(event)
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      running.current = true
      setPending(true)
      return Promise.resolve(result).finally(() => { running.current = false; setPending(false) })
    }
  }
  return <Comp
    data-slot="button"
    {...props}
    disabled={disabled || busy}
    aria-disabled={asChild && (disabled || busy) ? true : props["aria-disabled"]}
    aria-busy={busy || undefined}
    onClick={click}
    onClickCapture={event => {
      if (disabled || busy || running.current) { event.preventDefault(); event.stopPropagation(); return }
      onClickCapture?.(event)
    }}
  >
    {busy && <LoaderCircle data-button-spinner="" className="app-button-spinner size-4" aria-hidden="true" />}
    <Slottable>{children}</Slottable>
  </Comp>
}

function Button({ className, variant = "default", size = "default", ...props }: ActionButtonProps & VariantProps<typeof buttonVariants>) {
  return <ActionButton data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { ActionButton, Button, buttonVariants }
