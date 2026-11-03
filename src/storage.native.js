import Storage from "expo-sqlite/kv-store";
export const read = () => Storage.getItemAsync("bolso-v1");
export const write = (value) => Storage.setItemAsync("bolso-v1", value);
