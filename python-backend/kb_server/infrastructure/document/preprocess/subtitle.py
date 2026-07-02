# 该文件职责：定义 URL 字幕提取抽象，并提供 Bilibili/yt-dlp 聚合实现。

from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

try:
    import requests
except ModuleNotFoundError:
    requests = None  # type: ignore[assignment]

from .timestamp import build_segment_line


@dataclass(frozen=True)
class SubtitleResult:
    text: str
    language: str | None = None
    provider: str | None = None
    format: str | None = None


class SubtitleProvider(ABC):
    @abstractmethod
    def extract(self, url: str) -> SubtitleResult | None:
        raise NotImplementedError


class AggregateSubtitleProvider(SubtitleProvider):
    def __init__(self, providers: Iterable[SubtitleProvider]) -> None:
        self._providers = tuple(providers)
        if not self._providers:
            raise ValueError("aggregate subtitle provider requires at least one provider")

    def extract(self, url: str) -> SubtitleResult | None:
        last_error: Exception | None = None
        for provider in self._providers:
            try:
                result = provider.extract(url)
            except Exception as exc:
                last_error = exc
                continue
            if result is not None and result.text.strip():
                return result
        if last_error is not None:
            return None
        return None


class BilibiliSubtitleProvider(SubtitleProvider):
    _user_agent = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    def extract(self, url: str) -> SubtitleResult | None:
        if "bilibili.com" not in url and "b23.tv" not in url:
            return None
        session = self._build_session()
        state, bvid, initial_cid, final_url = self._get_initial_state(session, url)
        if not bvid:
            return None
        page_num = self._parse_page_from_url(final_url) or self._parse_page_from_url(url)
        _, aid, view_cid, pages = self._get_video_meta(session, bvid)
        cid = self._pick_cid_from_pages(view_cid or initial_cid, pages, page_num)
        if not aid:
            return None
        if not cid:
            return None
        raw_tracks, tracks, raw_api = self._extract_subtitles(session, aid, cid)
        if not tracks:
            raise RuntimeError(
                "未提取到 Bilibili 字幕: "
                + json.dumps(
                    {
                        "final_url": final_url,
                        "page_num": page_num,
                        "aid": aid,
                        "initial_cid": initial_cid,
                        "view_cid": view_cid,
                        "selected_cid": cid,
                        "api_subtitle_count": len(raw_tracks),
                        "raw_subtitle": (raw_api.get("data") or {}).get("subtitle") or {},
                        "user_is_login": (state or {}).get("user", {}).get("isLogin") if isinstance(state, dict) else None,
                    },
                    ensure_ascii=False,
                )
            )
        track = tracks[0]
        lines = _body_to_audio_style_lines(track.get("body") or [])
        text = "\n".join(lines).strip()
        if not text:
            return None
        return SubtitleResult(
            text=text,
            language=str(track.get("lang_doc") or track.get("lang") or "").strip() or None,
            provider="bilibili",
            format="json",
        )

    def _parse_bvid_or_aid(self, url: str) -> dict[str, object]:
        match = re.search(r"/(BV[0-9A-Za-z]+)", url)
        if match:
            return {"bvid": match.group(1)}
        match = re.search(r"/av(\d+)", url)
        if match:
            return {"aid": int(match.group(1))}
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        if "bvid" in query:
            return {"bvid": query["bvid"][0]}
        if "aid" in query:
            return {"aid": int(query["aid"][0])}
        raise ValueError("无法从 URL 中识别 bilibili 视频标识")

    @staticmethod
    def _extract_cid(url: str) -> int | None:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        if "cid" in query:
            return int(query["cid"][0])
        return None

    @staticmethod
    def _parse_page_from_url(url: str) -> int | None:
        parsed = urlparse(url)
        query = parse_qs(parsed.query)
        raw = query.get("p", [None])[0]
        if raw is None:
            return None
        return int(raw)

    @classmethod
    def _fetch_json(cls, url: str, *, referer: str = "https://www.bilibili.com/") -> dict:
        request = Request(url, headers={"User-Agent": cls._user_agent, "Referer": referer})
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8", errors="ignore"))

    @classmethod
    def _build_session(cls) -> requests.Session:
        if requests is None:
            raise ModuleNotFoundError("requests")
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": cls._user_agent,
                "Referer": "https://www.bilibili.com/",
                "Origin": "https://www.bilibili.com",
                "Accept": "application/json, text/plain, */*",
            }
        )
        cookie_string = os.getenv("KB_BILIBILI_COOKIE", "").strip()
        if cookie_string:
            for key, value in _parse_cookie_string(cookie_string).items():
                session.cookies.set(key, value, domain=".bilibili.com", path="/")
        return session

    @classmethod
    def _get_initial_state(cls, session: requests.Session, url: str) -> tuple[dict | None, str | None, int | None, str]:
        response = session.get(url, timeout=30)
        response.raise_for_status()
        html = response.text
        marker = "window.__INITIAL_STATE__="
        start = html.find(marker)
        if start == -1:
            return None, None, None, response.url
        start += len(marker)
        end = html.find(";(function()", start)
        if end == -1:
            end = html.find(";</script>", start)
        if end == -1:
            return None, None, None, response.url
        try:
            state = json.loads(html[start:end])
        except json.JSONDecodeError:
            return None, None, None, response.url
        bvid = state.get("bvid")
        cid = state.get("videoData", {}).get("cid") or state.get("cid")
        return state, bvid, int(cid) if cid else None, response.url

    @classmethod
    def _get_video_meta(cls, session: requests.Session, bvid: str) -> tuple[dict[str, Any], int | None, int | None, list[dict[str, Any]]]:
        payload = cls._fetch_json_with_session(session, f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}")
        data = payload.get("data") or {}
        aid = data.get("aid")
        cid = data.get("cid")
        pages = data.get("pages") or []
        return data, int(aid) if aid else None, int(cid) if cid else None, pages

    @classmethod
    def _pick_cid_from_pages(
        cls,
        default_cid: int | None,
        pages: list[dict[str, Any]],
        page_num: int | None,
    ) -> int | None:
        if page_num and 0 < page_num <= len(pages):
            page = pages[page_num - 1]
            cid = page.get("cid")
            return int(cid) if cid else default_cid
        return default_cid

    @classmethod
    def _extract_subtitles(
        cls,
        session: requests.Session,
        aid: int,
        cid: int,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        payload = cls._fetch_json_with_session(session, f"https://api.bilibili.com/x/player/wbi/v2?aid={aid}&cid={cid}")
        subtitles = ((payload.get("data") or {}).get("subtitle") or {}).get("subtitles") or []
        tracks: list[dict[str, Any]] = []
        for item in subtitles:
            subtitle_url = cls._normalize_subtitle_url(str(item.get("subtitle_url") or "").strip())
            if not subtitle_url:
                continue
            subtitle_payload = cls._fetch_json_with_session(
                session,
                subtitle_url,
                referer="https://www.bilibili.com/",
            )
            tracks.append(
                {
                    "lang": item.get("lan"),
                    "lang_doc": item.get("lan_doc"),
                    "subtitle_url": subtitle_url,
                    "body": subtitle_payload.get("body") or [],
                }
            )
        return subtitles, tracks, payload

    @classmethod
    def _fetch_json_with_session(
        cls,
        session: requests.Session,
        url: str,
        *,
        referer: str = "https://www.bilibili.com/",
    ) -> dict:
        response = session.get(url, headers={"Referer": referer}, timeout=30)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _normalize_subtitle_url(url: str) -> str:
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("http://"):
            return "https://" + url[len("http://"):]
        return url
def _body_to_audio_style_lines(body: list[dict]) -> list[str]:
    lines: list[str] = []
    for item in body:
        line = build_segment_line(
            text=item.get("content"),
            start_seconds=item.get("from", item.get("start")),
            end_seconds=item.get("to", item.get("end")),
        )
        if line:
            lines.append(line)
    return lines


def _parse_cookie_string(cookie_str: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for part in cookie_str.split(";"):
        normalized = part.strip()
        if not normalized or "=" not in normalized:
            continue
        key, value = normalized.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            cookies[key] = value
    return cookies
