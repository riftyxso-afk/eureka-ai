import { accessToken } from "./server";
import type { ConnectorId } from "./catalog";

type Input = { provider: ConnectorId; action: string; query: string; id: string; title: string; text: string };
export async function productivityTool(userId: string, input: Input) {
  const write = input.action === "create";
  const token = await accessToken(userId, input.provider, write);
  const request = async (url: string, body?: unknown, headers: Record<string,string> = {}) => {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Aplikasi menolak permintaan (" + response.status + "). Periksa izin koneksi.");
    const result = await response.json();
    if (result.ok === false) throw new Error("Aplikasi menolak permintaan. Periksa izin dan lokasi tujuan.");
    return result;
  };
  const id = (value: string) => {
    if (!/^[a-zA-Z0-9_!.-]{1,160}$/.test(value)) throw new Error("Tentukan id lokasi tujuan dari aplikasi.");
    return encodeURIComponent(value);
  };
  switch (input.provider) {
    case "github": {
      if (!write) return request("https://api.github.com/search/issues?" + new URLSearchParams({ q: input.query, per_page: "15" }));
      if (!/^[\w.-]+\/[\w.-]+$/.test(input.id)) throw new Error("Tentukan repositori owner/repo untuk membuat issue.");
      return request("https://api.github.com/repos/" + input.id + "/issues", { title: input.title, body: input.text });
    }
    case "todoist":
      return write ? request("https://api.todoist.com/api/v1/tasks", { content: input.title, description: input.text })
        : request("https://api.todoist.com/api/v1/tasks");
    case "slack":
      return write ? request("https://slack.com/api/chat.postMessage", { channel: input.id, text: input.text, unfurl_links: false })
        : request("https://slack.com/api/search.messages?" + new URLSearchParams({ query: input.query, count: "15" }));
    case "discord": {
      if (!input.id) throw new Error("Tentukan id channel Discord yang diizinkan.");
      return request("https://discord.com/api/v10/channels/" + id(input.id) + "/messages" + (write ? "" : "?limit=20"),
        write ? { content: input.text.slice(0, 2000), allowed_mentions: { parse: [] } } : undefined, { Authorization: "Bot " + token });
    }
    case "trello": {
      const separator = token.indexOf(":");
      if (separator < 1) throw new Error("Kredensial Trello harus berformat API_KEY:TOKEN.");
      const params = new URLSearchParams({ key: token.slice(0,separator), token: token.slice(separator+1) });
      if (!write) { params.set("query",input.query); params.set("modelTypes","cards"); params.set("cards_limit","15"); return request("https://api.trello.com/1/search?" + params); }
      params.set("idList",input.id);params.set("name",input.title);params.set("desc",input.text);
      return request("https://api.trello.com/1/cards?" + params, {});
    }
    case "zotero": {
      const identity = await request("https://api.zotero.org/keys/current",undefined,{ "Zotero-API-Key": token, "Zotero-API-Version":"3" });
      if (!identity.userID) throw new Error("Akses pustaka Zotero belum tersedia.");
      if (write) throw new Error("Zotero pada Eureka menyediakan pencarian referensi.");
      return request("https://api.zotero.org/users/" + id(String(identity.userID)) + "/items?" + new URLSearchParams({ q: input.query, limit:"20",format:"json" }),undefined,{ "Zotero-API-Key":token,"Zotero-API-Version":"3" });
    }
    case "onedrive":
    case "microsoft": {
      if (write) throw new Error("Gunakan konektor Microsoft untuk membaca file; pembuatan file belum tersedia.");
      const escaped = input.query.replace(/'/g,"''");
      return request("https://graph.microsoft.com/v1.0/me/drive/root/search(q='" + encodeURIComponent(escaped) + "')?$top=15");
    }
    case "teams": {
      const separator = input.id.indexOf(":");
      const team = input.id.slice(0, separator), channel = input.id.slice(separator + 1);
      if (separator < 1 || !/^[\w.-]+$/.test(team) || !/^[\w.:@-]+$/.test(channel)) throw new Error("Tentukan teamId:channelId untuk membaca percakapan Teams.");
      if (write) throw new Error("Konektor Teams menyediakan pembacaan channel.");
      return request("https://graph.microsoft.com/v1.0/teams/" + encodeURIComponent(team) + "/channels/" + encodeURIComponent(channel) + "/messages?$top=20");
    }
    default: throw new Error("Alat konektor belum tersedia.");
  }
}
