import { assertEquals } from "jsr:@std/assert@1";
import { appTarget } from "./logic.ts";

const at = (q: string) => appTarget(new URL(`https://fn.example/open-link?${q}`));

Deno.test("우리 앱 주소로 넘긴다", () => {
  assertEquals(
    at("type=post&id=666b2d4b-11b0-4efb-b4bc-a6cc7df9e317"),
    "poground://comment?type=post&id=666b2d4b-11b0-4efb-b4bc-a6cc7df9e317",
  );
  assertEquals(at("type=match&id=180"), "poground://comment?type=match&id=180");
});

Deno.test("모르는 갈래나 이상한 id 는 넘기지 않는다", () => {
  assertEquals(at("type=board&id=1"), null);
  assertEquals(at("type=post&id=https://evil.example"), null);
  assertEquals(at("type=post"), null);
  assertEquals(at(""), null);
});
