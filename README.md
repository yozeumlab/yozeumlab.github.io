# 요즘것들연구소 제휴링크 허브

정적 사이트. 서버 없음, 빌드 없음. `data/*.json`을 고쳐서 GitHub에 push하면 바로 반영됨.

## 상품 추가 (`data/products.json`)

```json
{
  "id": "고유값-아무거나",
  "platform_id": "coupang",
  "category_id": "categories.json에 있는 id 중 하나",
  "name": "상품명",
  "description": "짧은 한줄 설명",
  "image_url": "상품 이미지 URL",
  "affiliate_url": "트래킹 링크 (가격 저장 안 함)",
  "source_type": "MANUAL 또는 API",
  "start_date": "YYYY-MM-DD",
  "end_date": null,  // 종료일 없으면 null = 무기한 노출
  "is_active": true,
  "sort_order": 1,   // 숫자가 낮을수록 먼저 노출
  "created_at": "YYYY-MM-DD"
}
```

## 배너 추가 (`data/banners.json`)

```json
{
  "id": "고유값",
  "title": "배너 제목",
  "description": "짧은 설명",
  "image_url": "배너 이미지",
  "link_url": "연결할 링크",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD 또는 null",
  "is_active": true,
  "sort_order": 1
}
```

## 노출 조건

`is_active == true` AND `오늘 >= start_date` AND (`end_date`가 없거나 `오늘 <= end_date`) 인 것만 화면에 뜸. 별도 스케줄러 없이 페이지 로드 시 브라우저에서 오늘 날짜와 비교해서 자동 처리됨.
