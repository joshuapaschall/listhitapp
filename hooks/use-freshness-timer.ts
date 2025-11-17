"use client";

import { useEffect, useState } from "react";

export default function useFreshnessTimer(date: Date | null) {
  const calcFresh = () => {
    if (!date) return false;
    return Date.now() - date.getTime() < 5 * 60 * 1000;
  };
  const [fresh, setFresh] = useState(calcFresh);

  useEffect(() => {
    if (!date) return;
    const diff = Date.now() - date.getTime();
    if (diff >= 5 * 60 * 1000) return setFresh(false);
    const id = setTimeout(() => setFresh(false), 5 * 60 * 1000 - diff);
    return () => clearTimeout(id);
  }, [date]);

  return fresh;
}
