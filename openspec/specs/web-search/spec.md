# web-search Specification

## Purpose
Provides web search for the assistant chat and note enrichment through a primary provider (Firecrawl) with an automatic fallback to Tavily, so searches keep working (with uniformly formatted results) when the primary provider fails or returns nothing.

## Requirements

### Requirement: Fallback otomatis ke Tavily saat Firecrawl gagal
The system SHALL attempt searches with Firecrawl first; when Firecrawl errors out (network error or non-OK HTTP response) or returns zero usable results, the system SHALL automatically retry the same query with Tavily and use its results.

#### Scenario: Firecrawl error lalu Tavily dipakai
- **WHEN** a web search is requested and Firecrawl fails with an error
- **THEN** the system retries the search with Tavily and returns its results to the caller

#### Scenario: Firecrawl kosong lalu Tavily dipakai
- **WHEN** a web search is requested and Firecrawl succeeds but returns no usable results
- **THEN** the system retries the search with Tavily and returns its results to the caller

#### Scenario: Kedua provider gagal
- **WHEN** both Firecrawl and Tavily fail
- **THEN** the search returns an empty result set and the caller continues without crashing

### Requirement: Hasil pencarian diformat seragam
The system SHALL convert Tavily results into the same result shape used for Firecrawl results (URL, title, snippet), remove duplicates across providers, and filter known noise results before returning them.

#### Scenario: Hasil Tavily disamakan bentuknya
- **WHEN** a fallback search via Tavily returns results
- **THEN** each result carries the same fields as a Firecrawl result and is deduplicated against any existing results

### Requirement: Fallback berjalan tanpa API key Tavily
When `TAVILY_API_KEY` is not set in the backend environment, the system SHALL skip the Tavily fallback entirely and behave exactly as today (Firecrawl-only), without errors or warnings shown to users.

#### Scenario: Key belum diisi
- **WHEN** a search is requested and Firecrawl fails while `TAVILY_API_KEY` is not set
- **THEN** the search returns the Firecrawl outcome (empty on failure) and no Tavily call is attempted

### Requirement: Fallback berlaku di semua pemakai web search
The Tavily fallback SHALL apply to every feature that performs web searches: the assistant chat web-search tool and the note chapter enrichment pipeline.

#### Scenario: Chat web search memakai fallback
- **WHEN** the user activates web search in assistant chat and Firecrawl fails
- **THEN** the chat answer is built from Tavily results without any user-visible difference in flow

#### Scenario: Enrichment bab memakai fallback
- **WHEN** the note chapter enrichment performs a search and Firecrawl fails
- **THEN** enrichment continues using Tavily results and still records the used sources as references
