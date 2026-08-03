import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { normalisePatientPhotoSource } from "../../utils/profilePhoto";

type Props = {
  src?: string | null;
  name: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  alt?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PatientPhoto({ src, name, className = "", imageClassName = "", fallbackClassName = "", alt }: Props) {
  const resolvedSource = normalisePatientPhotoSource(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSource]);

  return (
    <div className={`aspect-square shrink-0 overflow-hidden ${className}`}>
      {resolvedSource && !failed ? (
        <img
          src={resolvedSource}
          alt={alt ?? `${name} profile`}
          className={`h-full w-full object-cover object-center ${imageClassName}`}
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`grid h-full w-full place-items-center ${fallbackClassName}`} aria-label={`${name} profile photo unavailable`}>
          {initials(name) || <UserRound className="h-8 w-8" />}
        </div>
      )}
    </div>
  );
}
