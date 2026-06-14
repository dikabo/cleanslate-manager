import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const clear = () => {
    sigRef.current?.clear();
    setHasSignature(false);
    onSignatureChange(null);
  };

  const handleEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setHasSignature(true);
      onSignatureChange(sigRef.current.toDataURL("image/png"));
    }
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{
            className: "w-full",
            style: { width: "100%", height: "150px" },
          }}
          onEnd={handleEnd}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {hasSignature ? "✓ Signature capturée" : "Signez dans la zone ci-dessus"}
        </p>
        {hasSignature && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>
    </div>
  );
}
