import { createButton } from '../../utils/dom-helpers';

export interface BreadcrumbCallbacks {
	onRootClick: () => void;
	onCrumbClick: (index: number) => void;
}

export function renderBreadcrumb(
	host: HTMLElement,
	drillPath: readonly string[],
	rootLabel: string,
	callbacks: BreadcrumbCallbacks,
): void {
	const breadcrumb = host.createDiv({ cls: 'rp-admin-breadcrumb' });
	const rootBtn = createButton(breadcrumb, {
		cls: drillPath.length === 0 ? 'rp-admin-crumb is-current' : 'rp-admin-crumb',
		text: rootLabel,
	});
	rootBtn.addEventListener('click', callbacks.onRootClick);

	drillPath.forEach((segment, index) => {
		breadcrumb.createEl('span', { cls: 'rp-admin-crumb-separator', text: '/' });
		const crumb = createButton(breadcrumb, {
			cls: index === drillPath.length - 1 ? 'rp-admin-crumb is-current' : 'rp-admin-crumb',
			text: segment,
		});
		crumb.addEventListener('click', () => { callbacks.onCrumbClick(index); });
	});
}
