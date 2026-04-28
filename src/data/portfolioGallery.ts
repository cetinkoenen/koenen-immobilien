export type PortfolioGalleryItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  matchTerms: string[];
};

export const portfolioGalleryItems: PortfolioGalleryItem[] = [
  {
    id: "rosensteinstr-25",
    title: "Rosenstein Str. 25",
    subtitle: "70191 Stuttgart",
    imageUrl: "/property-gallery/rosenstein.png",
    matchTerms: ["rosenstein", "rosensteinstr", "rosensteinstrasse", "rosenstein str"],
  },
  {
    id: "lilienthaler-str-54",
    title: "Lilienthaler Str. 54",
    subtitle: "28215 Bremen",
    imageUrl: "/property-gallery/lilienthaler.png",
    matchTerms: ["lilienthaler", "lilienthaler str", "lilienthaler strasse"],
  },
  {
    id: "hohenloher-str-78-1",
    title: "Hohenloher Str. 78/1",
    subtitle: "74243 Langenbrettach",
    imageUrl: "/property-gallery/hohenloher.png",
    matchTerms: ["hohenloher", "hohenloher str", "hohenloher strasse"],
  },
  {
    id: "fuerther-str-74",
    title: "Fürther Str. 74",
    subtitle: "28215 Bremen",
    imageUrl: "/property-gallery/fuerther.png",
    matchTerms: ["fürther", "fuerther", "further", "fuerther str", "fürther str"],
  },
  {
    id: "elsasser-str-52",
    title: "Elsasser Str. 52",
    subtitle: "28211 Bremen",
    imageUrl: "/property-gallery/elsasser.png",
    matchTerms: ["elsasser", "elsaesser", "elsässer", "elsasser str"],
  },
  {
    id: "colmarer-str-45",
    title: "Colmarer Str. 45",
    subtitle: "28211 Bremen",
    imageUrl: "/property-gallery/colmarer.jpg",
    matchTerms: ["colmarer", "colmarer str", "colmarer strasse"],
  },
];
