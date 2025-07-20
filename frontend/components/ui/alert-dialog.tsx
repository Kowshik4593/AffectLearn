'use client'

import * as React from "react"
import { createPortal } from "react-dom"

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const AlertDialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {}
})

const AlertDialog: React.FC<AlertDialogProps> = ({ open = false, onOpenChange = () => {}, children }) => {
  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className = '', children, ...props }, ref) => {
    const { open } = React.useContext(AlertDialogContext)
    
    if (!open) return null
    
    const content = (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" />
        <div
          ref={ref}
          className={`relative z-50 w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 ${className}`}
          {...props}
        >
          {children}
        </div>
      </div>
    )
    
    return typeof window !== 'undefined' ? createPortal(content, document.body) : null
  }
)
AlertDialogContent.displayName = "AlertDialogContent"

const AlertDialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <div className={`flex flex-col space-y-2 text-center sm:text-left p-6 pb-2 ${className}`} {...props}>
    {children}
  </div>
)

const AlertDialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <h2 className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`} {...props}>
    {children}
  </h2>
)

const AlertDialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <p className={`text-sm text-gray-600 dark:text-gray-300 ${className}`} {...props}>
    {children}
  </p>
)

const AlertDialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-2 ${className}`} {...props}>
    {children}
  </div>
)

const AlertDialogAction: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => (
  <button 
    className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-gray-900 transition-colors hover:bg-gray-800 dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} 
    {...props}
  >
    {children}
  </button>
)

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
}
