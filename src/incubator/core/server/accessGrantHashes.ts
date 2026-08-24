/** Server-only canonical access-grant hashes. Never export from a client barrel. */
export interface AccessGrantHashEntry {
  readonly accessGrantId: string;
  readonly encodedHash: string;
}

export const CANONICAL_ACCESS_GRANT_HASHES: readonly AccessGrantHashEntry[] = Object.freeze([
  { accessGrantId: "01", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$djHL11BIa4H8nl4hBJszfw==$vRij0lVyP0JqtSjEzMYuvCTZO/nugPvjPCcCpU1M4h4=" },
  { accessGrantId: "02", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$poRIFvk1zJoS58VaMfym3g==$Ng7jcKoiJMnfvpRokjTL/iewR5us41taaMa1uZ8cZ3s=" },
  { accessGrantId: "03", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$33uwIMqM77Hv53jOjM25ig==$WOoto2A0RaIeKvXg6UdgjcxKKf9qPvEeO83A8tnU6Wc=" },
  { accessGrantId: "04", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$Fffe4ayOCsp9ZBZaM5Avsg==$sl7rh0E35hMsUpDgSCkWiosTzqHM1iI9DFfcb+j6X48=" },
  { accessGrantId: "05", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$oH2hjrmlJwLdJ3ZES1HdKg==$h2CWON0CR6zMbDcZoSpgIwtiC4BIWpQs0QOTZ2XecUg=" },
  { accessGrantId: "06", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$CAMK74NPTbHffe4WPMtG8A==$PuBUjFzMonyniZsGnRhOZhsFQadFOH+nFWMVEt0w2x0=" },
  { accessGrantId: "07", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$gvs7UiT2LH5NWCUU77c3Mw==$RVjIqEbK7jLKya01bBSEpFPLlyA6v83WqCHNNGoa7us=" },
  { accessGrantId: "08", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$5MaXWh9ZCDZU11xKUVfoCg==$UfhRhr/pDTieFLkyn9JbizMMPGlAobJ+MFWbsFjv/tc=" },
  { accessGrantId: "09", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$yiZwrQOw/YALbllrxyrWlA==$Xt2lSi2cnnJXunBmRxivkGCS3s7ee6ZCen50GnCfAR8=" },
  { accessGrantId: "10", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$rKfkR7OVBUbnDqapY1YOaA==$6jdaoa0XoB/Wt1m18JhZSCZS59yqr7W9Ekclhu3UpP4=" },
  { accessGrantId: "11", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$BZ26ycVvXPdemZaxlDoYeg==$SLG4LqTMasDy9IodWBxRgN3DNVEBicCrWSekuzh/MRE=" },
  { accessGrantId: "12", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$Tck/FqZil8USnFpqYktXUg==$E7Bn4qxL7+qMZrx802bTbiAvNarijbXGPEFab6BxRIU=" },
  { accessGrantId: "13", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$Ain/xDmsQi0Lqtdk+cjHiw==$KyVVDOzZ1kBVPPkMDDYoSBpzeL4hCBEtjN5KuS1HAE0=" },
  { accessGrantId: "14", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$RhWVaBULAPkhBnNiuVuyuA==$Zf2NufQq/vPjHVhfyFy17jwAlkJWM4lH1fixhbe0yXs=" },
  { accessGrantId: "15", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$dLfuBVfuVGNJoTcXU40QrQ==$aFsPJE8OwsIC1CQ9VQh7QCrwDXeQXjK1M1PaRiIAzc8=" },
  { accessGrantId: "16", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$0pFogmr1wvULrGBggne1ng==$R253hO8HtBhK87OwUbDBEuBIC82RPtDy3IXzXIZOGlc=" },
  { accessGrantId: "17", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$MVWEy8Y2Pd1tF8WhVLpiCQ==$KQT6Q6bSCWZ50cibzmLd60nC9OTPXb6JGrXY3mmN1Qw=" },
  { accessGrantId: "18", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$/RkSfEeFXhwglBlRdh4h8g==$aObEc51FOVaN63dtGGAR4nxggYQNUkXnpKLU0hr18FE=" },
  { accessGrantId: "19", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$V/9uUdZyqL46SfE1Mfgsyw==$BUGlJzL244YYXTuMjonrrf47jkxmYNyeBW41jU3qFBY=" },
  { accessGrantId: "20", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$2m60C9HEEbzx+6AqbafI6g==$Wl1h7AE/SNiDwhRLyB4zFKt9lX9fNiJLjRM8nR3J8lw=" },
  { accessGrantId: "21", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$4ceQkxMCPjsb0tjRplvaHw==$JK4PDJYkmAJMWNNZPROyi9JbK5kBuaVtu0r3G45/WD4=" },
  { accessGrantId: "22", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$MesdUE75iBv3A3s9UsbXkg==$bWd8QXDYcSoft1bRrVIwZOoFAOnqvlcVLJlXH5ak3s8=" },
]);
