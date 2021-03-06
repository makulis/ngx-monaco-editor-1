/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import './contextview.css';
import { $ } from '../../builder.js';
import * as DOM from '../../dom.js';
import { dispose, toDisposable } from '../../../common/lifecycle.js';
export var AnchorAlignment;
(function (AnchorAlignment) {
    AnchorAlignment[AnchorAlignment["LEFT"] = 0] = "LEFT";
    AnchorAlignment[AnchorAlignment["RIGHT"] = 1] = "RIGHT";
})(AnchorAlignment || (AnchorAlignment = {}));
export var AnchorPosition;
(function (AnchorPosition) {
    AnchorPosition[AnchorPosition["BELOW"] = 0] = "BELOW";
    AnchorPosition[AnchorPosition["ABOVE"] = 1] = "ABOVE";
})(AnchorPosition || (AnchorPosition = {}));
export var LayoutAnchorPosition;
(function (LayoutAnchorPosition) {
    LayoutAnchorPosition[LayoutAnchorPosition["Before"] = 0] = "Before";
    LayoutAnchorPosition[LayoutAnchorPosition["After"] = 1] = "After";
})(LayoutAnchorPosition || (LayoutAnchorPosition = {}));
/**
 * Lays out a one dimensional view next to an anchor in a viewport.
 *
 * @returns The view offset within the viewport.
 */
export function layout(viewportSize, viewSize, anchor) {
    var anchorEnd = anchor.offset + anchor.size;
    if (anchor.position === LayoutAnchorPosition.Before) {
        if (viewSize <= viewportSize - anchorEnd) {
            return anchorEnd; // happy case, lay it out after the anchor
        }
        if (viewSize <= anchor.offset) {
            return anchor.offset - viewSize; // ok case, lay it out before the anchor
        }
        return Math.max(viewportSize - viewSize, 0); // sad case, lay it over the anchor
    }
    else {
        if (viewSize <= anchor.offset) {
            return anchor.offset - viewSize; // happy case, lay it out before the anchor
        }
        if (viewSize <= viewportSize - anchorEnd) {
            return anchorEnd; // ok case, lay it out after the anchor
        }
        return 0; // sad case, lay it over the anchor
    }
}
var ContextView = /** @class */ (function () {
    function ContextView(container) {
        var _this = this;
        this.$view = $('.context-view').hide();
        this.setContainer(container);
        this.toDispose = [toDisposable(function () {
                _this.setContainer(null);
            })];
        this.toDisposeOnClean = null;
    }
    ContextView.prototype.setContainer = function (container) {
        var _this = this;
        if (this.$container) {
            this.$container.getHTMLElement().removeChild(this.$view.getHTMLElement());
            this.$container.off(ContextView.BUBBLE_UP_EVENTS);
            this.$container.off(ContextView.BUBBLE_DOWN_EVENTS, true);
            this.$container = null;
        }
        if (container) {
            this.$container = $(container);
            this.$view.appendTo(this.$container);
            this.$container.on(ContextView.BUBBLE_UP_EVENTS, function (e) {
                _this.onDOMEvent(e, document.activeElement, false);
            });
            this.$container.on(ContextView.BUBBLE_DOWN_EVENTS, function (e) {
                _this.onDOMEvent(e, document.activeElement, true);
            }, null, true);
        }
    };
    ContextView.prototype.show = function (delegate) {
        if (this.isVisible()) {
            this.hide();
        }
        // Show static box
        this.$view.setClass('context-view').empty().style({ top: '0px', left: '0px' }).show();
        // Render content
        this.toDisposeOnClean = delegate.render(this.$view.getHTMLElement());
        // Set active delegate
        this.delegate = delegate;
        // Layout
        this.doLayout();
    };
    ContextView.prototype.layout = function () {
        if (!this.isVisible()) {
            return;
        }
        if (this.delegate.canRelayout === false) {
            this.hide();
            return;
        }
        if (this.delegate.layout) {
            this.delegate.layout();
        }
        this.doLayout();
    };
    ContextView.prototype.doLayout = function () {
        // Get anchor
        var anchor = this.delegate.getAnchor();
        // Compute around
        var around;
        // Get the element's position and size (to anchor the view)
        if (DOM.isHTMLElement(anchor)) {
            var elementPosition = DOM.getDomNodePagePosition(anchor);
            around = {
                top: elementPosition.top,
                left: elementPosition.left,
                width: elementPosition.width,
                height: elementPosition.height
            };
        }
        else {
            var realAnchor = anchor;
            around = {
                top: realAnchor.y,
                left: realAnchor.x,
                width: realAnchor.width || 0,
                height: realAnchor.height || 0
            };
        }
        var viewSize = this.$view.getTotalSize();
        var anchorPosition = this.delegate.anchorPosition || AnchorPosition.BELOW;
        var anchorAlignment = this.delegate.anchorAlignment || AnchorAlignment.LEFT;
        var verticalAnchor = { offset: around.top, size: around.height, position: anchorPosition === AnchorPosition.BELOW ? LayoutAnchorPosition.Before : LayoutAnchorPosition.After };
        var horizontalAnchor;
        if (anchorAlignment === AnchorAlignment.LEFT) {
            horizontalAnchor = { offset: around.left, size: 0, position: LayoutAnchorPosition.Before };
        }
        else {
            horizontalAnchor = { offset: around.left + around.width, size: 0, position: LayoutAnchorPosition.After };
        }
        var containerPosition = DOM.getDomNodePagePosition(this.$container.getHTMLElement());
        var top = layout(window.innerHeight, viewSize.height, verticalAnchor) - containerPosition.top;
        var left = layout(window.innerWidth, viewSize.width, horizontalAnchor) - containerPosition.left;
        this.$view.removeClass('top', 'bottom', 'left', 'right');
        this.$view.addClass(anchorPosition === AnchorPosition.BELOW ? 'bottom' : 'top');
        this.$view.addClass(anchorAlignment === AnchorAlignment.LEFT ? 'left' : 'right');
        this.$view.style({ top: top + "px", left: left + "px", width: 'initial' });
    };
    ContextView.prototype.hide = function (data) {
        if (this.delegate && this.delegate.onHide) {
            this.delegate.onHide(data);
        }
        this.delegate = null;
        if (this.toDisposeOnClean) {
            this.toDisposeOnClean.dispose();
            this.toDisposeOnClean = null;
        }
        this.$view.hide();
    };
    ContextView.prototype.isVisible = function () {
        return !!this.delegate;
    };
    ContextView.prototype.onDOMEvent = function (e, element, onCapture) {
        if (this.delegate) {
            if (this.delegate.onDOMEvent) {
                this.delegate.onDOMEvent(e, document.activeElement);
            }
            else if (onCapture && !DOM.isAncestor(e.target, this.$container.getHTMLElement())) {
                this.hide();
            }
        }
    };
    ContextView.prototype.dispose = function () {
        this.hide();
        this.toDispose = dispose(this.toDispose);
    };
    ContextView.BUBBLE_UP_EVENTS = ['click', 'keydown', 'focus', 'blur'];
    ContextView.BUBBLE_DOWN_EVENTS = ['click'];
    return ContextView;
}());
export { ContextView };
