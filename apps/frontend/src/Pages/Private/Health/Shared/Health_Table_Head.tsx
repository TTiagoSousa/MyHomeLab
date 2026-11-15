export interface Health_Table_Column {
  key: string;
  label: string;
  optional?: boolean;
}

interface Health_Table_Head_Props {
  columns: Health_Table_Column[];
}

const Health_Table_Head = ({ columns }: Health_Table_Head_Props) => (
  <div className='Health_Table_Row Health_Table_Head'>
    {columns.map((column) => (
      <span key={column.key} className={column.optional ? 'Health_Table_Optional' : ''}>
        {column.label}
      </span>
    ))}
  </div>
);

export default Health_Table_Head;
