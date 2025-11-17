"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface SidebarProviderProps {
  children: React.ReactNode
}

export const SidebarContext = React.createContext({
  isCollapsed: false,
  toggleCollapsed: () => {},
})

export const SidebarProvider = ({ children }: SidebarProviderProps) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed)
  }

  return <SidebarContext.Provider value={{ isCollapsed, toggleCollapsed }}>{children}</SidebarContext.Provider>
}

export const Sidebar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col h-screen fixed top-0 left-0 z-50 w-64 bg-background border-r transition-all duration-300 ease-in-out",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex-shrink-0 border-b p-4", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex-1 overflow-y-auto p-4", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarContent.displayName = "SidebarContent"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex-shrink-0 border-t p-4", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarFooter.displayName = "SidebarFooter"

export const SidebarMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-1", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("px-2 py-1.5 rounded-md hover:bg-muted", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <button ref={ref} className={cn("w-full text-left", className)} {...props}>
        {children}
      </button>
    )
  },
)
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { toggleCollapsed } = React.useContext(SidebarContext)
    return (
      <button
        ref={ref}
        onClick={toggleCollapsed}
        className={cn(
          "p-2 rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          className,
        )}
        {...props}
      />
    )
  },
)
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("text-sm font-semibold text-muted-foreground px-2", className)} {...props}>
        {children}
      </div>
    )
  },
)
SidebarMenuLabel.displayName = "SidebarMenuLabel"
