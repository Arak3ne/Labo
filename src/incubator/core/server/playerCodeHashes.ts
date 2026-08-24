/**
 * Server-only canonical player-code hashes.
 * This module contains no plaintext credential and must never enter a client barrel.
 */
export interface PlayerCodeHashEntry {
  readonly subjectId: string;
  readonly encodedHash: string;
}

export const CANONICAL_PLAYER_CODE_HASHES: readonly PlayerCodeHashEntry[] = Object.freeze([
  { subjectId: "A1", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$AIHiSyIIGLcU+Y/ObfdBhg==$UFWi9SfRhy/2J63xBKZ+yrkuzVgH86gWIeU7cIHwFQw=" },
  { subjectId: "A2", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$YsbtfTVRV6iovNewzuxq7Q==$Kv/XIC1JAoVlK9hP0Y/sEt81femywJBltyzg5grsp2E=" },
  { subjectId: "A3", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$XE6n+Kw21xpr5Z5+J2Hs0g==$0N/DDN564ZKmlQuSR58zisS9kt6wpO5vrhRhg2qjSEg=" },
  { subjectId: "A4", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$OoFR8SvLUC7mKzsAyPyqrA==$lcrHyJ2b2tQNi5WXRsRmrZ/VbiRxr+lAb7axRTz5a20=" },
  { subjectId: "B1", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$goO/CK7/R9AKQbWja019RQ==$uCqT3OXeq8mpZvwPHxDM4620oA9MExo+hWga5QdrawY=" },
  { subjectId: "B2", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$t9OKLmehm5GRPWNiAr1CfA==$YBQFuMf/d0/XrMzEAVUZQgpEw/Z1HQS2OUV1peB7Pz4=" },
  { subjectId: "B3", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$yEbhLXDRJ+hfCPe6lNoSyw==$ylxLBGUFUHm6hvN3uFgmJw/qfW20LaVN+S7oBu2+Wug=" },
  { subjectId: "B4", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$BrD17jDxNAGzTJAcs010oA==$Wyk90lsq8uGH63HTHjeLkRKhaOOxCFvLFK4oAVq4eYk=" },
  { subjectId: "C1", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$/xvms05Sl3WfgicuUrZHkg==$AuAkzjMUPwEbgy/xfTppHkrZryUElZB9k5KFXX4wqfI=" },
  { subjectId: "C2", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$siUCOgs6A06+NYj574jt+g==$ySbY+qWUSdBjuEEOGL98ZG1/cz3/qiK7+KIOWACeDpk=" },
  { subjectId: "C3", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$fPQwfEGz07Sk2jDpdkW5qA==$X9gBz5BcAPWYI3bvyr7Tg/KdS6PUtFaG/8xWv3mm3TU=" },
  { subjectId: "C4", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$InrX+ljpIys/YP1xC+L4SA==$Eug0xizWYZGOIIJ3Y/dgql6jQwfBgN1MOlJ8nooLoKs=" },
  { subjectId: "D1", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$2ywrv3gXKqtVZRJji+x8tA==$VvkFuZLLfo9JVb++QqN2yTWTrqSteuF9NSbwPPzilX4=" },
  { subjectId: "D2", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$1dQY3+FbMBmmLLX7E3cXwg==$piSw01krmmv6fUcdXW8IPR3N9frJiWxuwd3ZXzgCKrw=" },
  { subjectId: "D3", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$7l9jdjXy/VsUGNIbiSW8ag==$MxqB8dHk5EXpG6oFG20MoJ8V8rAu6PBVxCNBAqlSJOk=" },
  { subjectId: "D4", encodedHash: "scrypt$v=1$N=16384,r=8,p=1$ESvkox/yBUilamTMiKUeQQ==$V18zN7xEcjdhV14e3V2//sh68BkGfRWaaaX4glpgQdg=" },
]);
