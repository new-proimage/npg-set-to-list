(function () {

  'use strict';
  var amountOfAllItems = 30,
      amountOfChosenItems = 5;

  window.NPG = Ember.Application.create({});

  // Make override for the sake of hosting controller demonstration
  NPG.ApplicationController = Ember.Controller.extend({
    actions: {
      chosenItemChanged: function(selected, all) {
        console.log('swapping occurred');
      }
    },
    generateItems: function (amount) {
      return Array.apply(0, Array(amount)).map(function (x, idx) {
        return {
          index: idx,
          val: String.fromCharCode(65 + idx)
        }
      })
    },
    allItems: function () {
      return this.generateItems(amountOfAllItems)
    }.property(),
    chosenItems: function () {
      return this.generateItems(amountOfChosenItems)
    }.property()
  });

  var SelectionMixin = Ember.Mixin.create({
    init: function () {
      this.get(this.get('itemClassName')).reopen({
        classNameBindings: ['isSelected:selected'],
        isSelected: false,
        click: function (ev) {
          this.get('parentView').handleSelection(ev, this);
        }
      });
      this.set('selected', Ember.A([]));

      return this._super();
    },

    itemClassName: 'itemViewClass',
    childViewsDidChange: function (views, start, removed, added) {
      var i = 0;
      /*
      If the state of the panel is preRender, it means,
      it's building, then the selection shouldn't be added,
      as well as when the amount of added items is 0
       */
      if (this.state === 'preRender' || added === 0) { return; }
      while (i !== added) {
        this.addSelected(views[start + i]);
        i += 1;
      }
      return this._super.apply(this, arguments);
    },
    addSelected: function (itemView) {
      if (!this.get('selected').contains(itemView)) {
        itemView.set('isSelected', true);
        this.get('selected').pushObject(itemView);
      }
    },
    removeSelected: function (itemView) {
      if (this.get('selected').contains(itemView)) {
        itemView.set('isSelected', false);
        this.get('selected').removeObject(itemView);
      }
    },
    clearSelection: function () {
      var item;
      while (this.get('selected.length') !== 0) {
        item = this.get('selected').popObject();
        item.set('isSelected', false);
      }
    },
    handleSelection: function (ev, itemView) {
      if (itemView === void 0) { return; }
      // if non of the ctrl, meta, and shift keys
      // are pressed, clear the selection
      if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
        this.clearSelection();
      }

      // deselect the row if ctrl button is pressed
      // and the item is selected
      if ((ev.ctrlKey || ev.metaKey) && this.get('selected').contains(itemView)) {
        return this.removeSelected(itemView);
      }


      // if selection is performed with shift key
      // the selected items should be between the last
      // and currently clicked items
      if (ev.shiftKey) {
        var lastSelected = this.get('selected.lastObject'),
            lastSelectedIndex = this.get('content').indexOf(lastSelected.get('content')),
            itemViewIndex = this.get('content').indexOf(itemView.get('content')),
            minIndex = Math.min(lastSelectedIndex, itemViewIndex),
            maxIndex = Math.max(lastSelectedIndex, itemViewIndex),
            childViews = this.get('childViews');
        this.clearSelection();
        for (var i = minIndex; i <= maxIndex; i += 1) {
          this.addSelected(childViews[i]);
        }
      }

      this.addSelected(itemView);
    },
    selectWithArrow: function (ev, direction) {
      if (this.get('selected.length') !== 1) { return; }
      var selectedIndex = this.get('content').indexOf(this.get('selected.firstObject.content'));
      if (direction === 'up') {
        this.$()[0].scrollTop -= 30;
        // animation frame is require to set the selection
        // smoothly (no setTimeout(fn, 16)) after setting the top scroll position
        window.requestAnimationFrame(function () {
          this.handleSelection(ev, this.get('childViews')[selectedIndex - 1]);
        }.bind(this));
      }
      if (direction === 'down') {
        this.$()[0].scrollTop += 30;
        window.requestAnimationFrame(function () {
          this.handleSelection(ev, this.get('childViews')[selectedIndex + 1]);
        }.bind(this));
      }
    },
    selectAll: function () {
      this.get('childViews').forEach(function (itemView) {
        this.addSelected(itemView);
      }, this);
    },
    keyDown: function (ev) {
      // disable default scrolling strategy of the browser
      ev.preventDefault();
      switch (ev.keyCode) {
        // arrow up
        case 38:
          return this.selectWithArrow(ev, 'up');
        // arrow down
        case 40:
          return this.selectWithArrow(ev, 'down');
        // a
        case 65:
          if (ev.shiftKey) { return this.selectAll(); }
      }
    }

  });

  NPG.SelectionListsComponent = Ember.Component.extend({

    init: function () {
      var that = this;
      that.columnB = Ember.ArrayController.create({
        sortProperties: (that.sortProperties) ? that.sortProperties.split(',') : void 0,
        sortAscending: true,
        content: that.get('chosenItems')
      });
      that.columnA = Ember.ArrayController.create({
        sortProperties: (that.sortProperties) ? that.sortProperties.split(',') : void 0,
        sortAscending: true,
        content: (function () {
          var columnB = that.get('columnB'),
            availableItems = that.get('availableItems');

          return availableItems.filter(function (available) {
            return !columnB.find(function (item) {
              return JSON.stringify(item) === JSON.stringify(available);
            }, available);
          });
        })()
      });
      that.mediator = that.Mediator.create({
        channels: {}
      });
      return this._super();
    },

    classNames: ['selection-lists'],

    /**
     * Implements swap of the element from
     * column A to column B or vice versa
     * @param {string}  target          Panel name of target
     * @param {string}  destination     Panel name of destination
     * @param {array}   items           List of element in target panel
     */
    swap: function (target, destination, items) {
      var targetColumn = this.get(target),
          destColumn = this.get(destination);
      items.forEach(function (i) {
        var item = targetColumn.find(function (x) {
          return JSON.stringify(x) === JSON.stringify(i);
        });
        destColumn.pushObject(item);
        targetColumn.removeObject(item);
      });
      this.sendAction('chosenItemChanged', this.get('chosenItems'));
    },

    /**
     * Mediator is the object encapsulating
     * publish/subscribe mechanism for
     * exchanging commands between instances of
     * Panel View.
     * E.g. when click in one panel view is occurred,
     * all the rest should clear their selections.
     */
    Mediator: Ember.Object.extend({
      subscribe: function (channelName, subscriber, callback, context) {
        if (this.channels[channelName] === void 0) {
          this.channels[channelName] = [];
        }
        this.channels[channelName].pushObject({
          subscriber: subscriber,
          callback: callback,
          ctx: context
        });
      },
      publish: function (channelName) {
        var args = [].slice.call(arguments, 1);
        this.channels[channelName].forEach(function (item) {
          return item.callback.apply(item.ctx, args);
        })
      },
      unsubscribe: function (channelName, subscriber) {
        var obj = this.channels[channelName].findBy('subscriber', subscriber);
        this.channels[channelName].removeObject(obj);
      }
    }),

    /**
     * Panel View is the definition of the view that
     * represents left or right columns
     */
    PanelView: Ember.CollectionView.extend(SelectionMixin, {
      // rewrite template property of itemViewClass in case of
      // rowRender is provided in the component constructor
      init: function () {
        var rowRender = this.get('parentView.rowRender');
        if (rowRender !== void 0) {
          this.get('itemViewClass').reopen({
            template: Ember.Handlebars.compile(rowRender)
          });
        }
        this.get('controller.mediator').subscribe('clearOtherSelection', this.get('panel'), function (issuer) {
          if (this.get('panel') !== issuer) {
            this.clearSelection();
          }
        }, this);

        return this._super();
      },
      tagName: 'ul',

      attributeBindings: ['tabIndex'],

      tabIndex: -1,

      dragStart: function (ev) {
        var panelName = this.get('panel'), data;
        data = {
          columnName: panelName,
          items: this.get('selected').map(function (itemView) {
            return itemView.get('content');
          })
        };
        ev.dataTransfer.setData('Text', JSON.stringify(data));
        this.get('controller.mediator').publish('clearOtherSelection', this.get('panel'));
      },

      dragOver: function (ev) {
        ev.preventDefault();
      },

      drop: function (ev) {
        var data = JSON.parse(ev.dataTransfer.getData("Text")),
          panelName = this.get('panel');

        // drop is done over the same panel
        if (panelName === data.columnName) {
          return false;
        }
        this.get('controller').swap(data.columnName, panelName, data.items);
        this.get('controller.mediator').publish('clearOtherSelection', this.get('panel'));
        return false;
      },
      
      click: function (ev) {
        this.get('controller.mediator').publish('clearOtherSelection', this.get('panel'));
      },

      itemViewClass: Ember.View.extend({
        tagName: 'li',
        defaultTemplate: Ember.Handlebars.compile('{{view.content}}'),
        classNameBindings: ['isHovered: hovered'],
        attributeBindings: ['draggable'],
        draggable: 'true',
        isHovered: false,
        mouseEnter: function () {
          this.set('isHovered', true)
        },
        mouseLeave: function () {
          this.set('isHovered', false)
        },
        dragStart: function (ev) {
          var selected = this.get('parentView.selected');
          if (selected.length === 0) {
            this.get('parentView').handleSelection(ev, this);
          }
          if (selected.length === 1 && !selected.contains(this)) {
            this.get('parentView').handleSelection(ev, this);
          }
        }
      })
    })
  });

}());
