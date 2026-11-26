import type { ComponentProps } from "react"
import { DropdownMenu as Menu } from "radix-ui"
import { cn } from "cn"

const DropdownMenu = Menu.Root
const DropdownMenuTrigger = Menu.Trigger

function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Menu.Content>) {
  return <Menu.Portal><Menu.Content data-slot="dropdown-menu-content" sideOffset={sideOffset}
    className={cn("z-50 min-w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props}/></Menu.Portal>
}
function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item data-slot="dropdown-menu-item"
    className={cn("flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}/>
}
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem }
