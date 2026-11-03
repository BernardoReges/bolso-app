export const read = async () => localStorage.getItem("bolso-v1");
export const write = async (value) => localStorage.setItem("bolso-v1", value);
