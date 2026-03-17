import { useState } from "react";
import Link from "next/link";
import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";

export const TransactionHash = ({ hash }: { hash: string }) => {
  const [isAddressCopiedToClipboard, setIsAddressCopiedToClipboard] = useState(false);

  const copyAddressToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setIsAddressCopiedToClipboard(true);
      setTimeout(() => setIsAddressCopiedToClipboard(false), 800);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <div className="flex items-center">
      <Link href={`/blockexplorer/transaction/${hash}`}>
        {hash?.substring(0, 6)}...{hash?.substring(hash.length - 4)}
      </Link>
      {isAddressCopiedToClipboard ? (
        <CheckCircleIcon
          className="ml-1.5 text-xl font-normal text-base-content h-5 w-5 cursor-pointer"
          aria-hidden="true"
        />
      ) : (
        <DocumentDuplicateIcon
          className="ml-1.5 text-xl font-normal h-5 w-5 cursor-pointer"
          aria-hidden="true"
          onClick={() => copyAddressToClipboard(hash)}
        />
      )}
    </div>
  );
};
