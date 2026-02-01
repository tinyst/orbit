export const locate = (element) => {
    const tag = element.tagName.toLowerCase();
    const cn = element.className.split(" ").filter((v) => !!v).map((v) => `.${v}`).join("");
    return element.id ? `[${tag}#${element.id}]` : `[${tag}${cn}]`;
};
