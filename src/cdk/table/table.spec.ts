import {
  Component,
  ContentChild,
  ContentChildren,
  Input,
  QueryList,
  Type,
  ViewChild
} from '@angular/core';
import {ComponentFixture, TestBed, fakeAsync, flush} from '@angular/core/testing';
import {CdkTable} from './table';
import {CollectionViewer, DataSource} from '@angular/cdk/collections';
import {combineLatest, BehaviorSubject, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {CdkTableModule} from './index';
import {
  getTableDuplicateColumnNameError,
  getTableMissingMatchingRowDefError,
  getTableMissingRowDefsError,
  getTableMultipleDefaultRowDefsError,
  getTableUnknownColumnError,
  getTableUnknownDataSourceError
} from './table-errors';
import {CdkHeaderRowDef, CdkRowDef} from './row';
import {CdkColumnDef} from './cell';

describe('CdkTable', () => {
  let fixture: ComponentFixture<any>;
  let component: any;
  let tableElement: HTMLElement;

  function createComponent<T>(componentType: Type<T>, declarations: any[] = []):
      ComponentFixture<T> {
    TestBed.configureTestingModule({
      imports: [CdkTableModule],
      declarations: [componentType, ...declarations],
    }).compileComponents();

    return TestBed.createComponent<T>(componentType);
  }

  function setupTableTestApp(componentType: Type<any>, declarations: any[] = []) {
    fixture = createComponent(componentType, declarations);
    component = fixture.componentInstance;
    tableElement = fixture.nativeElement.querySelector('cdk-table');

    fixture.detectChanges();
  }

  describe('in a typical simple use case', () => {
    let dataSource: FakeDataSource;
    let table: CdkTable<TestData>;

    beforeEach(() => {
      setupTableTestApp(SimpleCdkTableApp);

      component = fixture.componentInstance as SimpleCdkTableApp;
      dataSource = component.dataSource;
      table = component.table;

      fixture.detectChanges();
    });

    describe('should initialize', () => {
      it('with a connected data source', () => {
        expect(table.dataSource).toBe(dataSource);
        expect(dataSource.isConnected).toBe(true);
      });

      it('with a rendered header with the right number of header cells', () => {
        const header = getHeaderRow(tableElement);

        expect(header).toBeTruthy();
        expect(header.classList).toContain('customHeaderRowClass');
        expect(getHeaderCells(tableElement).length).toBe(component.columnsToRender.length);
      });

      it('with rendered rows with right number of row cells', () => {
        const rows = getRows(tableElement);

        expect(rows.length).toBe(dataSource.data.length);
        rows.forEach(row => {
          expect(row.classList).toContain('customRowClass');
          expect(getCells(row).length).toBe(component.columnsToRender.length);
        });
      });

      it('with column class names provided to header and data row cells', () => {
        getHeaderCells(tableElement).forEach((headerCell, index) => {
          expect(headerCell.classList).toContain(`cdk-column-${component.columnsToRender[index]}`);
        });

        getRows(tableElement).forEach(row => {
          getCells(row).forEach((cell, index) => {
            expect(cell.classList).toContain(`cdk-column-${component.columnsToRender[index]}`);
          });
        });
      });

      it('with the right accessibility roles', () => {
        expect(tableElement.getAttribute('role')).toBe('grid');

        expect(getHeaderRow(tableElement).getAttribute('role')).toBe('row');
        getHeaderCells(tableElement).forEach(cell => {
          expect(cell.getAttribute('role')).toBe('columnheader');
        });

        getRows(tableElement).forEach(row => {
          expect(row.getAttribute('role')).toBe('row');
          getCells(row).forEach(cell => {
            expect(cell.getAttribute('role')).toBe('gridcell');
          });
        });
      });
    });

    it('should disconnect the data source when table is destroyed', () => {
      expect(dataSource.isConnected).toBe(true);

      fixture.destroy();
      expect(dataSource.isConnected).toBe(false);
    });

    it('should re-render the rows when the data changes', () => {
      dataSource.addData();
      fixture.detectChanges();

      expect(getRows(tableElement).length).toBe(dataSource.data.length);

      // Check that the number of cells is correct
      getRows(tableElement).forEach(row => {
        expect(getCells(row).length).toBe(component.columnsToRender.length);
      });
    });

    it('should use differ to add/remove/move rows', () => {
      // Each row receives an attribute 'initialIndex' the element's original place
      getRows(tableElement).forEach((row: Element, index: number) => {
        row.setAttribute('initialIndex', index.toString());
      });

      // Prove that the attributes match their indicies
      const initialRows = getRows(tableElement);
      expect(initialRows[0].getAttribute('initialIndex')).toBe('0');
      expect(initialRows[1].getAttribute('initialIndex')).toBe('1');
      expect(initialRows[2].getAttribute('initialIndex')).toBe('2');

      // Swap first and second data in data array
      const copiedData = component.dataSource!.data.slice();
      const temp = copiedData[0];
      copiedData[0] = copiedData[1];
      copiedData[1] = temp;

      // Remove the third element
      copiedData.splice(2, 1);

      // Add new data
      component.dataSource!.data = copiedData;
      component.dataSource!.addData();

      // Expect that the first and second rows were swapped and that the last row is new
      const changedRows = getRows(tableElement);
      expect(changedRows.length).toBe(3);
      expect(changedRows[0].getAttribute('initialIndex')).toBe('1');
      expect(changedRows[1].getAttribute('initialIndex')).toBe('0');
      expect(changedRows[2].getAttribute('initialIndex')).toBe(null);
    });

    it('should clear the row view containers on destroy', () => {
      const rowOutlet = fixture.componentInstance.table._rowOutlet.viewContainer;
      const headerPlaceholder = fixture.componentInstance.table._headerRowOutlet.viewContainer;

      spyOn(rowOutlet, 'clear').and.callThrough();
      spyOn(headerPlaceholder, 'clear').and.callThrough();

      fixture.destroy();

      expect(rowOutlet.clear).toHaveBeenCalled();
      expect(headerPlaceholder.clear).toHaveBeenCalled();
    });

    it('should match the right table content with dynamic data', () => {
      const initialDataLength = dataSource.data.length;
      expect(dataSource.data.length).toBe(3);

      let data = dataSource.data;
      expectTableToMatchContent(tableElement, [
        ['Column A', 'Column B', 'Column C'],
        [data[0].a, data[0].b, data[0].c],
        [data[1].a, data[1].b, data[1].c],
        [data[2].a, data[2].b, data[2].c],
        ['Footer A', 'Footer B', 'Footer C'],
      ]);

      // Add data to the table and recreate what the rendered output should be.
      dataSource.addData();
      expect(dataSource.data.length).toBe(initialDataLength + 1); // Make sure data was added
      fixture.detectChanges();

      data = dataSource.data;
      expectTableToMatchContent(tableElement, [
        ['Column A', 'Column B', 'Column C'],
        [data[0].a, data[0].b, data[0].c],
        [data[1].a, data[1].b, data[1].c],
        [data[2].a, data[2].b, data[2].c],
        [data[3].a, data[3].b, data[3].c],
        ['Footer A', 'Footer B', 'Footer C'],
      ]);
    });

    it('should be able to dynamically change the columns for header and rows', () => {
      expect(dataSource.data.length).toBe(3);

      let data = dataSource.data;
      expectTableToMatchContent(tableElement, [
        ['Column A', 'Column B', 'Column C'],
        [data[0].a, data[0].b, data[0].c],
        [data[1].a, data[1].b, data[1].c],
        [data[2].a, data[2].b, data[2].c],
        ['Footer A', 'Footer B', 'Footer C'],
      ]);

      // Remove column_a and swap column_b/column_c.
      component.columnsToRender = ['column_c', 'column_b'];
      fixture.detectChanges();

      let changedTableContent = [['Column C', 'Column B']];
      dataSource.data.forEach(rowData => changedTableContent.push([rowData.c, rowData.b]));

      data = dataSource.data;
      expectTableToMatchContent(tableElement, [
        ['Column C', 'Column B'],
        [data[0].c, data[0].b],
        [data[1].c, data[1].b],
        [data[2].c, data[2].b],
        ['Footer C', 'Footer B'],
      ]);
    });
  });

  describe('with different data inputs other than data source', () => {
    let baseData: TestData[] = [
      {a: 'a_1', b: 'b_1', c: 'c_1'},
      {a: 'a_2', b: 'b_2', c: 'c_2'},
      {a: 'a_3', b: 'b_3', c: 'c_3'},
    ];

    beforeEach(() => {
      setupTableTestApp(CdkTableWithDifferentDataInputsApp);
      component = fixture.componentInstance;
    });

    it('should render with data array input', () => {
      const data = baseData.slice();
      component.dataSource = data;
      fixture.detectChanges();

      const expectedRender = [
        ['Column A', 'Column B', 'Column C'],
        ['a_1', 'b_1', 'c_1'],
        ['a_2', 'b_2', 'c_2'],
        ['a_3', 'b_3', 'c_3'],
      ];
      expectTableToMatchContent(tableElement, expectedRender);

      // Push data to the array but neglect to tell the table, should be no change
      data.push({a: 'a_4', b: 'b_4', c: 'c_4'});

      expectTableToMatchContent(tableElement, expectedRender);

      // Notify table of the change, expect another row
      component.table.renderRows();
      fixture.detectChanges();

      expectedRender.push(['a_4', 'b_4', 'c_4']);
      expectTableToMatchContent(tableElement, expectedRender);

      // Remove a row and expect the change in rows
      data.pop();
      component.table.renderRows();

      expectedRender.pop();
      expectTableToMatchContent(tableElement, expectedRender);

      // Remove the data input entirely and expect no rows - just header.
      component.dataSource = null;
      fixture.detectChanges();

      expectTableToMatchContent(tableElement, [expectedRender[0]]);

      // Add back the data to verify that it renders rows
      component.dataSource = data;
      fixture.detectChanges();

      expectTableToMatchContent(tableElement, expectedRender);
    });

    it('should render with data stream input', () => {
      const data = baseData.slice();
      const stream = new BehaviorSubject<TestData[]>(data);
      component.dataSource = stream;
      fixture.detectChanges();

      const expectedRender = [
        ['Column A', 'Column B', 'Column C'],
        ['a_1', 'b_1', 'c_1'],
        ['a_2', 'b_2', 'c_2'],
        ['a_3', 'b_3', 'c_3'],
      ];
      expectTableToMatchContent(tableElement, expectedRender);

      // Push data to the array and emit the data array on the stream
      data.push({a: 'a_4', b: 'b_4', c: 'c_4'});
      stream.next(data);
      fixture.detectChanges();

      expectedRender.push(['a_4', 'b_4', 'c_4']);
      expectTableToMatchContent(tableElement, expectedRender);

      // Push data to the array but rather than emitting, call renderRows.
      data.push({a: 'a_5', b: 'b_5', c: 'c_5'});
      component.table.renderRows();
      fixture.detectChanges();

      expectedRender.push(['a_5', 'b_5', 'c_5']);
      expectTableToMatchContent(tableElement, expectedRender);

      // Remove a row and expect the change in rows
      data.pop();
      expectedRender.pop();
      stream.next(data);

      expectTableToMatchContent(tableElement, expectedRender);

      // Remove the data input entirely and expect no rows - just header.
      component.dataSource = null;
      fixture.detectChanges();

      expectTableToMatchContent(tableElement, [expectedRender[0]]);

      // Add back the data to verify that it renders rows
      component.dataSource = stream;
      fixture.detectChanges();

      expectTableToMatchContent(tableElement, expectedRender);
    });

    it('should throw an error if the data source is not valid', () => {
      component.dataSource = {invalid: 'dataSource'};

      expect(() => fixture.detectChanges())
          .toThrowError(getTableUnknownDataSourceError().message);
    });

    it('should throw an error if the data source is not valid', () => {
      component.dataSource = undefined;
      fixture.detectChanges();

      // Expect the table to render just the header, no rows
      expectTableToMatchContent(tableElement, [
        ['Column A', 'Column B', 'Column C']
      ]);
    });
  });

  describe('missing row defs', () => {
    it('should be able to render without a header row def', () => {
      setupTableTestApp(MissingHeaderRowDefCdkTableApp);
      expectTableToMatchContent(tableElement, [
        ['a_1'],  // Data rows
        ['a_2'],
        ['a_3'],
        ['Footer A'],  // Footer row
      ]);
    });

    it('should be able to render without a data row def', () => {
      setupTableTestApp(MissingRowDefCdkTableApp);
      expectTableToMatchContent(tableElement, [
        ['Column A'],  // Header row
        ['Footer A'],  // Footer row
      ]);
    });

    it('should be able to render without a footer row def', () => {
      setupTableTestApp(MissingFooterRowDefCdkTableApp);
      expectTableToMatchContent(tableElement, [
        ['Column A'],  // Header row
        ['a_1'],  // Data rows
        ['a_2'],
        ['a_3'],
      ]);
    });
  });

  it('should render correctly when using native HTML tags', () => {
    const thisFixture = createComponent(NativeHtmlTableApp);
    const thisTableElement = thisFixture.nativeElement.querySelector('table');
    thisFixture.detectChanges();

    expectTableToMatchContent(thisTableElement, [
      ['Column A', 'Column B', 'Column C'],
      ['a_1', 'b_1', 'c_1'],
      ['a_2', 'b_2', 'c_2'],
      ['a_3', 'b_3', 'c_3'],
    ]);
  });

  it('should render cells even if row data is falsy', () => {
    setupTableTestApp(BooleanRowCdkTableApp);
    expectTableToMatchContent(tableElement, [
      [''], // Header row
      ['false'], // Data rows
      ['true'],
      ['false'],
      ['true'],
    ]);
  });

  it('should be able to apply class-friendly css class names for the column cells', () => {
    setupTableTestApp(CrazyColumnNameCdkTableApp);
    // Column was named 'crazy-column-NAME-1!@#$%^-_&*()2'
    expect(getHeaderCells(tableElement)[0].classList)
        .toContain('cdk-column-crazy-column-NAME-1-------_----2');
  });

  it('should not clobber an existing table role', () => {
    setupTableTestApp(CustomRoleCdkTableApp);
    expect(tableElement.getAttribute('role')).toBe('treegrid');
  });

  it('should throw an error if two column definitions have the same name', () => {
    expect(() => createComponent(DuplicateColumnDefNameCdkTableApp).detectChanges())
        .toThrowError(getTableDuplicateColumnNameError('column_a').message);
  });

  it('should throw an error if a column definition is requested but not defined', () => {
    expect(() => createComponent(MissingColumnDefCdkTableApp).detectChanges())
        .toThrowError(getTableUnknownColumnError('column_a').message);
  });

  it('should throw an error if the row definitions are missing', () => {
    expect(() => createComponent(MissingAllRowDefsCdkTableApp).detectChanges())
        .toThrowError(getTableMissingRowDefsError().message);
  });

  it('should not throw an error if columns are undefined on initialization', () => {
    setupTableTestApp(UndefinedColumnsCdkTableApp);

    // Header should be empty since there are no columns to display.
    const headerRow = getHeaderRow(tableElement);
    expect(headerRow.textContent).toBe('');

    // Rows should be empty since there are no columns to display.
    const rows = getRows(tableElement);
    expect(rows[0].textContent).toBe('');
    expect(rows[1].textContent).toBe('');
    expect(rows[2].textContent).toBe('');
  });

  it('should be able to dynamically add/remove column definitions', () => {
    setupTableTestApp(DynamicColumnDefinitionsCdkTableApp);

    // Add a new column and expect it to show up in the table
    let columnA = 'columnA';
    component.dynamicColumns.push(columnA);
    fixture.detectChanges();
    expectTableToMatchContent(tableElement, [
      [columnA], // Header row
      [columnA], // Data rows
      [columnA],
      [columnA],
    ]);

    // Add another new column and expect it to show up in the table
    let columnB = 'columnB';
    component.dynamicColumns.push(columnB);
    fixture.detectChanges();
    expectTableToMatchContent(tableElement, [
      [columnA, columnB], // Header row
      [columnA, columnB], // Data rows
      [columnA, columnB],
      [columnA, columnB],
    ]);

    // Remove column A expect only column B to be rendered
    component.dynamicColumns.shift();
    fixture.detectChanges();
    expectTableToMatchContent(tableElement, [
      [columnB], // Header row
      [columnB], // Data rows
      [columnB],
      [columnB],
    ]);
  });

  it('should be able to register column, row, and header row definitions outside content', () => {
    setupTableTestApp(OuterTableApp, [WrapperCdkTableApp]);

    // The first two columns were defined in the wrapped table component as content children,
    // while the injected columns were provided to the wrapped table from the outer component.
    // A special row was provided with a when predicate that shows the single column with text.
    // The header row was defined by the outer component.
    expectTableToMatchContent(tableElement, [
      ['Content Column A', 'Content Column B', 'Injected Column A', 'Injected Column B'],
      ['injected row with when predicate'],
      ['a_2', 'b_2', 'a_2', 'b_2'],
      ['a_3', 'b_3', 'a_3', 'b_3']
    ]);
  });

  describe('using when predicate', () => {
    it('should be able to display different row templates based on the row data', () => {
      setupTableTestApp(WhenRowCdkTableApp);
      let data = component.dataSource.data;
      expectTableToMatchContent(tableElement, [
        ['Column A', 'Column B', 'Column C'],
        [data[0].a, data[0].b, data[0].c],
        ['index_1_special_row'],
        ['c3_special_row'],
        [data[3].a, data[3].b, data[3].c],
      ]);
    });

    it('should error if there is row data that does not have a matching row template',
      fakeAsync(() => {
        expect(() => {
          try {
            createComponent(WhenRowWithoutDefaultCdkTableApp).detectChanges();
            flush();
          } catch {
            flush();
          }
        }).toThrowError(getTableMissingMatchingRowDefError().message);
    }));

    it('should error if there are multiple rows that do not have a when function', fakeAsync(() => {
      let whenFixture = createComponent(WhenRowMultipleDefaultsCdkTableApp);
      expect(() => {
        whenFixture.detectChanges();
        flush();
      }).toThrowError(getTableMultipleDefaultRowDefsError().message);
    }));
  });

  describe('with trackBy', () => {
    function createTestComponentWithTrackyByTable(trackByStrategy) {
      fixture = createComponent(TrackByCdkTableApp);

      component = fixture.componentInstance;
      component.trackByStrategy = trackByStrategy;

      tableElement = fixture.nativeElement.querySelector('cdk-table');
      fixture.detectChanges();

      // Each row receives an attribute 'initialIndex' the element's original place
      getRows(tableElement).forEach((row: Element, index: number) => {
        row.setAttribute('initialIndex', index.toString());
      });

      // Prove that the attributes match their indicies
      const initialRows = getRows(tableElement);
      expect(initialRows[0].getAttribute('initialIndex')).toBe('0');
      expect(initialRows[1].getAttribute('initialIndex')).toBe('1');
      expect(initialRows[2].getAttribute('initialIndex')).toBe('2');
    }

    // Swap first two elements, remove the third, add new data
    function mutateData() {
      // Swap first and second data in data array
      const copiedData = component.dataSource.data.slice();
      const temp = copiedData[0];
      copiedData[0] = copiedData[1];
      copiedData[1] = temp;

      // Remove the third element
      copiedData.splice(2, 1);

      // Add new data
      component.dataSource.data = copiedData;
      component.dataSource.addData();
    }

    it('should add/remove/move rows with reference-based trackBy', () => {
      createTestComponentWithTrackyByTable('reference');
      mutateData();

      // Expect that the first and second rows were swapped and that the last row is new
      const changedRows = getRows(tableElement);
      expect(changedRows.length).toBe(3);
      expect(changedRows[0].getAttribute('initialIndex')).toBe('1');
      expect(changedRows[1].getAttribute('initialIndex')).toBe('0');
      expect(changedRows[2].getAttribute('initialIndex')).toBe(null);
    });

    it('should add/remove/move rows with changed references without property-based trackBy', () => {
      createTestComponentWithTrackyByTable('reference');
      mutateData();

      // Change each item reference to show that the trackby is not checking the item properties.
      component.dataSource.data = component.dataSource.data
          .map(item => { return {a: item.a, b: item.b, c: item.c}; });

      // Expect that all the rows are considered new since their references are all different
      const changedRows = getRows(tableElement);
      expect(changedRows.length).toBe(3);
      expect(changedRows[0].getAttribute('initialIndex')).toBe(null);
      expect(changedRows[1].getAttribute('initialIndex')).toBe(null);
      expect(changedRows[2].getAttribute('initialIndex')).toBe(null);
    });

    it('should add/remove/move rows with changed references with property-based trackBy', () => {
      createTestComponentWithTrackyByTable('propertyA');
      mutateData();

      // Change each item reference to show that the trackby is checking the item properties.
      // Otherwise this would cause them all to be removed/added.
      component.dataSource.data = component.dataSource.data
          .map(item => { return {a: item.a, b: item.b, c: item.c}; });

      // Expect that the first and second rows were swapped and that the last row is new
      const changedRows = getRows(tableElement);
      expect(changedRows.length).toBe(3);
      expect(changedRows[0].getAttribute('initialIndex')).toBe('1');
      expect(changedRows[1].getAttribute('initialIndex')).toBe('0');
      expect(changedRows[2].getAttribute('initialIndex')).toBe(null);
    });

    it('should add/remove/move rows with changed references with index-based trackBy', () => {
      createTestComponentWithTrackyByTable('index');
      mutateData();

      // Change each item reference to show that the trackby is checking the index.
      // Otherwise this would cause them all to be removed/added.
      component.dataSource.data = component.dataSource.data
          .map(item => { return {a: item.a, b: item.b, c: item.c}; });

      // Expect first two to be the same since they were swapped but indicies are consistent.
      // The third element was removed and caught by the table so it was removed before another
      // item was added, so it is without an initial index.
      const changedRows = getRows(tableElement);
      expect(changedRows.length).toBe(3);
      expect(changedRows[0].getAttribute('initialIndex')).toBe('0');
      expect(changedRows[1].getAttribute('initialIndex')).toBe('1');
      expect(changedRows[2].getAttribute('initialIndex')).toBe(null);
    });

    it('should change row implicit data even when trackBy finds no changes', () => {
      createTestComponentWithTrackyByTable('index');
      const firstRow = getRows(tableElement)[0];
      expect(firstRow.textContent!.trim()).toBe('a_1 b_1');
      expect(firstRow.getAttribute('initialIndex')).toBe('0');
      mutateData();

      // Change each item reference to show that the trackby is checking the index.
      // Otherwise this would cause them all to be removed/added.
      component.dataSource.data = component.dataSource.data
          .map(item => ({a: item.a, b: item.b, c: item.c}));

      // Expect the rows were given the right implicit data even though the rows were not moved.
      fixture.detectChanges();
      expect(firstRow.textContent!.trim()).toBe('a_2 b_2');
      expect(firstRow.getAttribute('initialIndex')).toBe('0');
    });
  });

  it('should match the right table content with dynamic data source', () => {
    setupTableTestApp(DynamicDataSourceCdkTableApp);

    // Expect that the component has no data source and the table element reflects empty data.
    expect(component.dataSource).toBeUndefined();
    expectTableToMatchContent(tableElement, [
      ['Column A']
    ]);

    // Add a data source that has initialized data. Expect that the table shows this data.
    const dynamicDataSource = new FakeDataSource();
    component.dataSource = dynamicDataSource;
    fixture.detectChanges();
    expect(dynamicDataSource.isConnected).toBe(true);

    const data = component.dataSource.data;
    expectTableToMatchContent(tableElement, [
      ['Column A'],
      [data[0].a],
      [data[1].a],
      [data[2].a],
    ]);

    // Remove the data source and check to make sure the table is empty again.
    component.dataSource = undefined;
    fixture.detectChanges();

    // Expect that the old data source has been disconnected.
    expect(dynamicDataSource.isConnected).toBe(false);
    expectTableToMatchContent(tableElement, [
      ['Column A']
    ]);

    // Reconnect a data source and check that the table is populated
    const newDynamicDataSource = new FakeDataSource();
    component.dataSource = newDynamicDataSource;
    fixture.detectChanges();
    expect(newDynamicDataSource.isConnected).toBe(true);

    const newData = component.dataSource.data;
    expectTableToMatchContent(tableElement, [
      ['Column A'],
      [newData[0].a],
      [newData[1].a],
      [newData[2].a],
    ]);
  });

  it('should be able to apply classes to rows based on their context', () => {
    setupTableTestApp(RowContextCdkTableApp);

    let rowElements = tableElement.querySelectorAll('cdk-row');

    // Rows should not have any context classes
    for (let i = 0; i < rowElements.length; i++) {
      expect(rowElements[i].classList.contains('custom-row-class-first')).toBe(false);
      expect(rowElements[i].classList.contains('custom-row-class-last')).toBe(false);
      expect(rowElements[i].classList.contains('custom-row-class-even')).toBe(false);
      expect(rowElements[i].classList.contains('custom-row-class-odd')).toBe(false);
    }

    // Enable all the context classes
    component.enableRowContextClasses = true;
    fixture.detectChanges();

    expect(rowElements[0].classList.contains('custom-row-class-first')).toBe(true);
    expect(rowElements[0].classList.contains('custom-row-class-last')).toBe(false);
    expect(rowElements[0].classList.contains('custom-row-class-even')).toBe(true);
    expect(rowElements[0].classList.contains('custom-row-class-odd')).toBe(false);

    expect(rowElements[1].classList.contains('custom-row-class-first')).toBe(false);
    expect(rowElements[1].classList.contains('custom-row-class-last')).toBe(false);
    expect(rowElements[1].classList.contains('custom-row-class-even')).toBe(false);
    expect(rowElements[1].classList.contains('custom-row-class-odd')).toBe(true);

    expect(rowElements[2].classList.contains('custom-row-class-first')).toBe(false);
    expect(rowElements[2].classList.contains('custom-row-class-last')).toBe(true);
    expect(rowElements[2].classList.contains('custom-row-class-even')).toBe(true);
    expect(rowElements[2].classList.contains('custom-row-class-odd')).toBe(false);
  });

  it('should be able to apply classes to cells based on their row context', () => {
    setupTableTestApp(RowContextCdkTableApp);

    const rowElements = fixture.nativeElement.querySelectorAll('cdk-row');

    for (let i = 0; i < rowElements.length; i++) {
      // Cells should not have any context classes
      const cellElements = rowElements[i].querySelectorAll('cdk-cell');
      for (let j = 0; j < cellElements.length; j++) {
        expect(cellElements[j].classList.contains('custom-cell-class-first')).toBe(false);
        expect(cellElements[j].classList.contains('custom-cell-class-last')).toBe(false);
        expect(cellElements[j].classList.contains('custom-cell-class-even')).toBe(false);
        expect(cellElements[j].classList.contains('custom-cell-class-odd')).toBe(false);
      }
    }

    // Enable the context classes
    component.enableCellContextClasses = true;
    fixture.detectChanges();

    let cellElement = rowElements[0].querySelectorAll('cdk-cell')[0];
    expect(cellElement.classList.contains('custom-cell-class-first')).toBe(true);
    expect(cellElement.classList.contains('custom-cell-class-last')).toBe(false);
    expect(cellElement.classList.contains('custom-cell-class-even')).toBe(true);
    expect(cellElement.classList.contains('custom-cell-class-odd')).toBe(false);

    cellElement = rowElements[1].querySelectorAll('cdk-cell')[0];
    expect(cellElement.classList.contains('custom-cell-class-first')).toBe(false);
    expect(cellElement.classList.contains('custom-cell-class-last')).toBe(false);
    expect(cellElement.classList.contains('custom-cell-class-even')).toBe(false);
    expect(cellElement.classList.contains('custom-cell-class-odd')).toBe(true);

    cellElement = rowElements[2].querySelectorAll('cdk-cell')[0];
    expect(cellElement.classList.contains('custom-cell-class-first')).toBe(false);
    expect(cellElement.classList.contains('custom-cell-class-last')).toBe(true);
    expect(cellElement.classList.contains('custom-cell-class-even')).toBe(true);
    expect(cellElement.classList.contains('custom-cell-class-odd')).toBe(false);
  });
});

interface TestData {
  a: string;
  b: string;
  c: string;
}

class FakeDataSource extends DataSource<TestData> {
  isConnected = false;

  get data() { return this._dataChange.getValue(); }
  set data(data: TestData[]) { this._dataChange.next(data); }
  _dataChange = new BehaviorSubject<TestData[]>([]);

  constructor() {
    super();
    for (let i = 0; i < 3; i++) { this.addData(); }
  }

  connect(collectionViewer: CollectionViewer) {
    this.isConnected = true;
    const streams = [this._dataChange, collectionViewer.viewChange];
    return combineLatest<TestData[]>(streams).pipe(map(data => data[0]));
  }

  disconnect() {
    this.isConnected = false;
  }

  addData() {
    const nextIndex = this.data.length + 1;

    let copiedData = this.data.slice();
    copiedData.push({
      a: `a_${nextIndex}`,
      b: `b_${nextIndex}`,
      c: `c_${nextIndex}`
    });

    this.data = copiedData;
  }
}

class BooleanDataSource extends DataSource<boolean> {
  _dataChange = new BehaviorSubject<boolean[]>([false, true, false, true]);

  connect(): Observable<boolean[]> {
    return this._dataChange;
  }

  disconnect() { }
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer A </cdk-footer-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer B </cdk-footer-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <cdk-header-cell *cdkHeaderCellDef> Column C </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.c}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer C </cdk-footer-cell>
      </ng-container>

      <cdk-header-row class="customHeaderRowClass"
                      *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row class="customRowClass"
               *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
      <cdk-footer-row class="customFooterRowClass"
                      *cdkFooterRowDef="columnsToRender"></cdk-footer-row>
    </cdk-table>
  `
})
class SimpleCdkTableApp {
  dataSource: FakeDataSource | undefined = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b', 'column_c'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.c}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
    </cdk-table>
  `
})
class CdkTableWithDifferentDataInputsApp {
  dataSource: DataSource<TestData> | Observable<TestData[]> | TestData[] | any = null;
  columnsToRender = ['column_a', 'column_b', 'column_c'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef></cdk-header-cell>
        <cdk-cell *cdkCellDef="let data"> {{data}} </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="['column_a']"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: ['column_a']"></cdk-row>
    </cdk-table>
  `
})
class BooleanRowCdkTableApp {
  dataSource = new BooleanDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.c}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="index1Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> index_1_special_row </cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="c3Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> c3_special_row </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
      <cdk-row *cdkRowDef="let row; columns: ['index1Column']; when: isIndex1"></cdk-row>
      <cdk-row *cdkRowDef="let row; columns: ['c3Column']; when: hasC3"></cdk-row>
    </cdk-table>
  `
})
class WhenRowCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b', 'column_c'];
  isIndex1 = (index: number, _rowData: TestData) => index == 1;
  hasC3 = (_index: number, rowData: TestData) => rowData.c == 'c_3';

  constructor() { this.dataSource.addData(); }

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.c}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="index1Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> index_1_special_row </cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="c3Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> c3_special_row </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: ['index1Column']; when: isIndex1"></cdk-row>
      <cdk-row *cdkRowDef="let row; columns: ['c3Column']; when: hasC3"></cdk-row>
    </cdk-table>
  `
})
class WhenRowWithoutDefaultCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b', 'column_c'];
  isIndex1 = (index: number, _rowData: TestData) => index == 1;
  hasC3 = (_index: number, rowData: TestData) => rowData.c == 'c_3';

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.c}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="index1Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> index_1_special_row </cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="c3Column">
        <cdk-header-cell *cdkHeaderCellDef> Column C</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> c3_special_row </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
      <cdk-row *cdkRowDef="let row; columns: ['index1Column']"></cdk-row>
      <cdk-row *cdkRowDef="let row; columns: ['c3Column']; when: hasC3"></cdk-row>
    </cdk-table>
  `
})
class WhenRowMultipleDefaultsCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b', 'column_c'];
  hasC3 = (_index: number, rowData: TestData) => rowData.c == 'c_3';

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
    </cdk-table>
  `
})
class DynamicDataSourceCdkTableApp {
  dataSource: FakeDataSource | undefined;
  columnsToRender = ['column_a'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource" [trackBy]="trackBy">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column B</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
    </cdk-table>
  `
})
class TrackByCdkTableApp {
  trackByStrategy: 'reference' | 'propertyA' | 'index' = 'reference';

  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;

  trackBy = (index: number, item: TestData) => {
    switch (this.trackByStrategy) {
      case 'reference': return item;
      case 'propertyA': return item.a;
      case 'index': return index;
    }
  }
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container [cdkColumnDef]="column" *ngFor="let column of dynamicColumns">
        <cdk-header-cell *cdkHeaderCellDef> {{column}} </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{column}} </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="dynamicColumns"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: dynamicColumns;"></cdk-row>
    </cdk-table>
  `
})
class DynamicColumnDefinitionsCdkTableApp {
  dynamicColumns: any[] = [];
  dataSource: FakeDataSource = new FakeDataSource();

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource" role="treegrid">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
    </cdk-table>
  `
})
class CustomRoleCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container [cdkColumnDef]="columnsToRender[0]">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender"></cdk-row>
    </cdk-table>
  `
})
class CrazyColumnNameCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['crazy-column-NAME-1!@#$%^-_&*()2'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="['column_a']"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: ['column_a']"></cdk-row>
    </cdk-table>
  `
})
class DuplicateColumnDefNameCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_b">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="['column_a']"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: ['column_a']"></cdk-row>
    </cdk-table>
  `
})
class MissingColumnDefCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>
    </cdk-table>
  `
})
class MissingAllRowDefsCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer A </cdk-footer-cell>
      </ng-container>

      <cdk-row *cdkRowDef="let row; columns: ['column_a']"></cdk-row>
      <cdk-footer-row *cdkFooterRowDef="['column_a']"></cdk-footer-row>
    </cdk-table>
  `
})
class MissingHeaderRowDefCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer A </cdk-footer-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="['column_a']"></cdk-header-row>
      <cdk-footer-row *cdkFooterRowDef="['column_a']"></cdk-footer-row>
    </cdk-table>
  `
})
class MissingRowDefCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
        <cdk-footer-cell *cdkFooterCellDef> Footer A </cdk-footer-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="['column_a']"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: ['column_a']"></cdk-row>
    </cdk-table>
  `
})
class MissingFooterRowDefCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}}</cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="undefinedColumns"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: undefinedColumns"></cdk-row>
    </cdk-table>
  `
})
class UndefinedColumnsCdkTableApp {
  undefinedColumns;
  dataSource: FakeDataSource = new FakeDataSource();
}

@Component({
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <cdk-header-cell *cdkHeaderCellDef> Column A</cdk-header-cell>
        <cdk-cell *cdkCellDef="let row; let first = first;
                               let last = last; let even = even; let odd = odd"
                  [ngClass]="{
                    'custom-cell-class-first': enableCellContextClasses && first,
                    'custom-cell-class-last': enableCellContextClasses && last,
                    'custom-cell-class-even': enableCellContextClasses && even,
                    'custom-cell-class-odd': enableCellContextClasses && odd
                  }">
          {{row.a}}
        </cdk-cell>
      </ng-container>
      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row *cdkRowDef="let row; columns: columnsToRender;
                           let first = first; let last = last; let even = even; let odd = odd"
               [ngClass]="{
                 'custom-row-class-first': enableRowContextClasses && first,
                 'custom-row-class-last': enableRowContextClasses && last,
                 'custom-row-class-even': enableRowContextClasses && even,
                 'custom-row-class-odd': enableRowContextClasses && odd
               }">
      </cdk-row>
    </cdk-table>
  `
})
class RowContextCdkTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender = ['column_a'];
  enableRowContextClasses = false;
  enableCellContextClasses = false;
}

@Component({
  selector: 'wrapper-table',
  template: `
    <cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="content_column_a">
        <cdk-header-cell *cdkHeaderCellDef> Content Column A </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
      </ng-container>
      <ng-container cdkColumnDef="content_column_b">
        <cdk-header-cell *cdkHeaderCellDef> Content Column B </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}} </cdk-cell>
      </ng-container>

      <cdk-row *cdkRowDef="let row; columns: columns"></cdk-row>
    </cdk-table>
  `
})
class WrapperCdkTableApp<T> {
  @ContentChildren(CdkColumnDef) columnDefs: QueryList<CdkColumnDef>;
  @ContentChild(CdkHeaderRowDef) headerRowDef: CdkHeaderRowDef;
  @ContentChildren(CdkRowDef) rowDefs: QueryList<CdkRowDef<T>>;

  @ViewChild(CdkTable) table: CdkTable<T>;

  @Input() columns: string[];
  @Input() dataSource: DataSource<T>;

  ngAfterContentInit() {
    // Register the content's column, row, and header row definitions.
    this.columnDefs.forEach(columnDef => this.table.addColumnDef(columnDef));
    this.rowDefs.forEach(rowDef => this.table.addRowDef(rowDef));
    this.table.setHeaderRowDef(this.headerRowDef);
  }
}

@Component({
  template: `
    <wrapper-table [dataSource]="dataSource" [columns]="columnsToRender">
      <ng-container cdkColumnDef="injected_column_a">
        <cdk-header-cell *cdkHeaderCellDef> Injected Column A </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.a}} </cdk-cell>
      </ng-container>
      <ng-container cdkColumnDef="injected_column_b">
        <cdk-header-cell *cdkHeaderCellDef> Injected Column B </cdk-header-cell>
        <cdk-cell *cdkCellDef="let row"> {{row.b}} </cdk-cell>
      </ng-container>

      <!-- Only used for the 'when' row, the first row -->
      <ng-container cdkColumnDef="special_column">
        <cdk-cell *cdkCellDef="let row"> injected row with when predicate </cdk-cell>
      </ng-container>

      <cdk-header-row *cdkHeaderRowDef="columnsToRender"></cdk-header-row>
      <cdk-row class="first-row" *cdkRowDef="let row; columns: ['special_column']; when: firstRow">
      </cdk-row>
    </wrapper-table>
  `
})
class OuterTableApp {
  dataSource: FakeDataSource = new FakeDataSource();
  columnsToRender =
      ['content_column_a', 'content_column_b', 'injected_column_a', 'injected_column_b'];

  firstRow = i => i === 0;
}

@Component({
  template: `
    <table cdk-table [dataSource]="dataSource">
      <ng-container cdkColumnDef="column_a">
        <th cdk-header-cell *cdkHeaderCellDef> Column A</th>
        <td cdk-cell *cdkCellDef="let row"> {{row.a}}</td>
      </ng-container>

      <ng-container cdkColumnDef="column_b">
        <th cdk-header-cell *cdkHeaderCellDef> Column B</th>
        <td cdk-cell *cdkCellDef="let row"> {{row.b}}</td>
      </ng-container>

      <ng-container cdkColumnDef="column_c">
        <th cdk-header-cell *cdkHeaderCellDef> Column C</th>
        <td cdk-cell *cdkCellDef="let row"> {{row.c}}</td>
      </ng-container>

      <tr cdk-header-row *cdkHeaderRowDef="columnsToRender"></tr>
      <tr cdk-row *cdkRowDef="let row; columns: columnsToRender" class="customRowClass"></tr>
    </table>
  `
})
class NativeHtmlTableApp {
  dataSource: FakeDataSource | undefined = new FakeDataSource();
  columnsToRender = ['column_a', 'column_b', 'column_c'];

  @ViewChild(CdkTable) table: CdkTable<TestData>;
}

function getElements(element: Element, query: string): Element[] {
  return [].slice.call(element.querySelectorAll(query));
}

function getHeaderRow(tableElement: Element): Element {
  return tableElement.querySelector('.cdk-header-row')!;
}

function getFooterRow(tableElement: Element): Element {
  return tableElement.querySelector('.cdk-footer-row')!;
}

function getRows(tableElement: Element): Element[] {
  return getElements(tableElement, '.cdk-row');
}
function getCells(row: Element): Element[] {
  return row ? getElements(row, '.cdk-cell') : [];
}

function getHeaderCells(tableElement: Element): Element[] {
  return getElements(getHeaderRow(tableElement), '.cdk-header-cell');
}

function getFooterCells(tableElement: Element): Element[] {
  return getElements(getFooterRow(tableElement), '.cdk-footer-cell');
}

function getActualTableContent(tableElement: Element): string[][] {
  let actualTableContent: Element[][] = [];
  if (getHeaderRow(tableElement)) {
    actualTableContent.push(getHeaderCells(tableElement));
  }

  // Check data row cells
  const rows = getRows(tableElement).map(row => getCells(row));
  actualTableContent = actualTableContent.concat(rows);

  if (getFooterRow(tableElement)) {
    actualTableContent.push(getFooterCells(tableElement));
  }

  // Convert the nodes into their text content;
  return actualTableContent.map(row => row.map(cell => cell.textContent!.trim()));
}

function expectTableToMatchContent(tableElement: Element, expected: any[]) {
  const missedExpectations: string[] = [];
  function checkCellContent(actualCell: string, expectedCell: string) {
    if (actualCell !== expectedCell) {
      missedExpectations.push(`Expected cell contents to be ${expectedCell} but was ${actualCell}`);
    }
  }

  const actual = getActualTableContent(tableElement);

  // Make sure the number of rows match
  if (actual.length !== expected.length) {
    missedExpectations.push(`Expected ${expected.length} total rows but got ${actual.length}`);
    fail(missedExpectations.join('\n'));
  }

  actual.forEach((row, rowIndex) => {
    const expectedRow = expected[rowIndex];

    // Make sure the number of cells match
    if (row.length !== expectedRow.length) {
      missedExpectations.push(`Expected ${expectedRow.length} cells in row but got ${row.length}`);
      fail(missedExpectations.join('\n'));
    }

    row.forEach((actualCell, cellIndex) => {
      const expectedCell = expectedRow ? expectedRow[cellIndex] : null;
      checkCellContent(actualCell, expectedCell);
    });
  });

  if (missedExpectations.length) {
    fail(missedExpectations.join('\n'));
  }
}
