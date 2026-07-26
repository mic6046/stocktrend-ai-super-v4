import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface TruncatedTextProps {
  text: string;
  maxLines?: number;
  className?: string;
  buttonClassName?: string;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLines = 5,
  className = "",
  buttonClassName = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        // Measure scrollHeight vs clientHeight when line-clamp is applied
        const isOverflowing = textRef.current.scrollHeight > textRef.current.clientHeight + 1;
        setNeedsTruncation(isOverflowing);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text, maxLines]);

  if (!text) return null;

  return (
    <div className="w-full space-y-1 overflow-hidden">
      <p
        ref={textRef}
        className={cn(
          "break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal text-xs sm:text-sm leading-relaxed transition-all duration-200",
          !isExpanded && "line-clamp-5 overflow-hidden text-ellipsis",
          className
        )}
        style={
          !isExpanded
            ? {
                display: '-webkit-box',
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }
            : undefined
        }
      >
        {text}
      </p>

      {(needsTruncation || isExpanded) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1 mt-1 cursor-pointer focus:outline-none",
            buttonClassName
          )}
        >
          {isExpanded ? (
            <>
              <span>Show Less</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Read More</span>
              <ChevronDown className="w-3 h-3 text-cyan-400" />
            </>
          )}
        </button>
      )}
    </div>
  );
};
