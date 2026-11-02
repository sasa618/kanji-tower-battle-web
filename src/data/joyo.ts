// Characters of the game that belong to the 常用漢字表 (2010), taken from Unihan's kJoyoKanji field.
// Kept apart from kanji.json so the published entries stay byte-for-byte the same.
const JOYO='木日月人口水火林森明休回困炎唱東晶囚一土田子女力心目言寸立山石好男岩相信畑加思音意村寺時詩侍想二三本大天仁王且付仙吐因団如位体肘里妬泣冒品待架胃討崩淡棚棟暗億談憶臆全助呈旺咽姻査埋恩理黒童栓詮墨憧瞳保倍佳垣封恒培添燥百入勝器嬢導幽恋曇朝樹氷煩雷瞬礎謎鬱響鐘臨踏蚕犬皇末腐帽賀慮凍霜裏街頬筋宴聖潮嘲黙';
const joyoSet=new Set(JOYO);
export const isJoyo=(char:string)=>joyoSet.has(char);
