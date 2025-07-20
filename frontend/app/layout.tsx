import './globals.css'

export const metadata = {
  title: 'AffectLearn - AI-Powered STEM Tutor',
  description: 'Experience personalized learning that understands how you feel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
        {children}
      </body>
    </html>
  )
}
