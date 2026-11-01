import { describe, expect, test } from 'vitest';
import { parseContributions } from './contributions';

// github.com/users/<user>/contributions 응답에서 필요한 부분만 줄인 예시
const html = `
<table>
<tr>
<td tabindex="0" data-ix="0" aria-selected="false" style="width: 10px" data-date="2025-11-03" id="contribution-day-component-1-0" data-level="0" role="gridcell" class="ContributionCalendar-day"></td>
<td tabindex="-1" data-ix="1" data-date="2025-11-10" id="contribution-day-component-1-1" data-level="2" role="gridcell" class="ContributionCalendar-day"></td>
</tr>
<tr>
<td data-date="2025-11-02" id="contribution-day-component-0-0" data-level="4" class="ContributionCalendar-day"></td>
</tr>
</table>
<tool-tip id="tooltip-a" for="contribution-day-component-1-0" popover="manual" class="sr-only">No contributions on November 3rd.</tool-tip>
<tool-tip id="tooltip-b" for="contribution-day-component-1-1" popover="manual" class="sr-only">3 contributions on November 10th.</tool-tip>
<tool-tip id="tooltip-c" for="contribution-day-component-0-0" popover="manual" class="sr-only">1,204 contributions on November 2nd.</tool-tip>
`;

describe('parseContributions', () => {
	test('날짜순으로 날짜·단계·횟수를 돌려준다', () => {
		expect(parseContributions(html)).toEqual([
			{ date: '2025-11-02', level: 4, count: 1204 },
			{ date: '2025-11-03', level: 0, count: 0 },
			{ date: '2025-11-10', level: 2, count: 3 },
		]);
	});
	test('형식이 다르면 빈 배열', () => {
		expect(parseContributions('<html>Not Found</html>')).toEqual([]);
	});
});
