export interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  url: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  documents: Document[];
}

export const mockStudents: Student[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice.johnson@email.com',
    documents: [
      {
        id: 'd1',
        name: 'Resume.pdf',
        type: 'PDF',
        size: '245 KB',
        uploadDate: '2024-01-15',
        url: '#',
      },
      {
        id: 'd2',
        name: 'Transcript.pdf',
        type: 'PDF',
        size: '1.2 MB',
        uploadDate: '2024-01-20',
        url: '#',
      },
    ],
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob.smith@email.com',
    documents: [
      {
        id: 'd3',
        name: 'Certificate.jpg',
        type: 'JPG',
        size: '890 KB',
        uploadDate: '2024-02-10',
        url: '#',
      },
    ],
  },
  {
    id: '3',
    name: 'Carol Davis',
    email: 'carol.davis@email.com',
    documents: [
      {
        id: 'd4',
        name: 'ID_Card.png',
        type: 'PNG',
        size: '156 KB',
        uploadDate: '2024-02-12',
        url: '#',
      },
      {
        id: 'd5',
        name: 'Portfolio.pdf',
        type: 'PDF',
        size: '3.4 MB',
        uploadDate: '2024-02-15',
        url: '#',
      },
      {
        id: 'd6',
        name: 'Letter.pdf',
        type: 'PDF',
        size: '125 KB',
        uploadDate: '2024-02-18',
        url: '#',
      },
    ],
  },
  {
    id: '4',
    name: 'David Wilson',
    email: 'david.wilson@email.com',
    documents: [],
  },
];

export const mockDocuments: Document[] = [
  {
    id: 'd1',
    name: 'My_Resume.pdf',
    type: 'PDF',
    size: '245 KB',
    uploadDate: '2024-01-15',
    url: '#',
  },
  {
    id: 'd2',
    name: 'Academic_Transcript.pdf',
    type: 'PDF',
    size: '1.2 MB',
    uploadDate: '2024-01-20',
    url: '#',
  },
];
