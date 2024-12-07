import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

export function LoadingModal({ isOpen }: { isOpen: boolean }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = [
    "calculating best routes...",
    "optimizing deliveries...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open={isOpen} modal>
      <DialogContent className="sm:max-w-md" hideClose>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-lg font-medium mb-1">hold on, our AI is</p>
            <p className="text-lg font-medium text-primary">{messages[messageIndex]}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
