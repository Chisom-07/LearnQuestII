import { ReactNode } from "react";
import logo from "@/assets/odiuko-shield-transparent.png";

interface LayoutProps {
  children: ReactNode;
  header?: ReactNode;
  hideDefaultHeader?: boolean;
}

export default function Layout({ children, header, hideDefaultHeader }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {header ?? (
        !hideDefaultHeader && (
          <header className="bg-primary text-primary-foreground shadow-lg">
            <div className="container mx-auto px-4 py-4 flex items-center">
              <span className="text-xl font-heading font-bold">LearnQuest</span>
            </div>
          </header>
        )
      )}

      <div className="flex-1">{children}</div>

      <footer className="bg-primary border-t border-navy-light">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs font-body tracking-wide text-primary-foreground/70">
            Powered by{" "}
            <a href="https://sites.google.com/view/odiuko?usp=sharing" target="_blank" rel="noopener noreferrer" className="text-accent font-semibold hover:underline transition-colors">Odiuko Educational Services</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
