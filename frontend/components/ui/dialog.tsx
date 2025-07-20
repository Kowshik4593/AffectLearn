'use client'

import * as React from "react"
import { createPortal } from "react-dom"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {}
})

const Dialog: React.FC<DialogProps> = ({ open = false, onOpenChange = () => {}, children }) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = '', children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext)
    
    if (!open) return null
    
    const content = (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div 
          className="fixed inset-0 bg-black/50" 
          onClick={() => onOpenChange(false)}
        />
        <div
          ref={ref}
          className={`relative z-50 w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}
          {...props}
        >
          {children}
        </div>
      </div>
    )
    
    return typeof window !== 'undefined' ? createPortal(content, document.body) : null
  }
)
DialogContent.displayName = "DialogContent"

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-2 ${className}`} {...props}>
    {children}
  </div>
)

const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <h2 className={`text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-white ${className}`} {...props}>
    {children}
  </h2>
)

const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <p className={`text-sm text-gray-600 dark:text-gray-300 ${className}`} {...props}>
    {children}
  </p>
)

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
