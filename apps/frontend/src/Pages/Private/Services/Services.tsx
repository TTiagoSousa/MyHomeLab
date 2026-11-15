import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Services.scss';
import {
  useCategories,
  type Service,
  type CategoryWithServices,
  type ServiceHosting,
} from '../../../Hooks/Categories/useCategories';
import { useCategory } from '../../../Hooks/Categories/useCategory';
import { useService } from '../../../Hooks/Service/useService';
import { SERVICE_HOSTING_OPTIONS } from '../../../Constants/serviceHosting';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Service_Edit_Modal from '../../../Components/Modals/Service_Edit_Modal/Service_Edit_Modal';
import Service_Add_Modal from '../../../Components/Modals/Service_Add_Modal/Service_Add_Modal';
import Category_Add_Modal from '../../../Components/Modals/Category_Add_Modal/Category_Add_Modal';
import * as Icon from '../../../Imports/icons';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  getFirstCollision,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Page_Help, { Page_Intro } from '../../../Components/Page_Help/Page_Help';
import Empty_State from '../../../Components/Empty_State/Empty_State';

interface Category_Pill_Body_Props {
  category: CategoryWithServices;
  isEditMode: boolean;
  onDelete: () => void;
}

const Category_Pill_Body = ({ category, isEditMode, onDelete }: Category_Pill_Body_Props) => (
  <>
    <span className='Services_category_name'>{category.name}</span>
    <span className='Services_category_count'>{category.services.length}</span>

    {isEditMode && (
      <button
        className='Services_category_delete'
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Icon.Close />
      </button>
    )}
  </>
);

interface Sortable_Category_Pill_Props {
  category: CategoryWithServices;
  isActive: boolean;
  isEditMode: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const Sortable_Category_Pill = ({
  category,
  isActive,
  isEditMode,
  disabled,
  onSelect,
  onDelete,
}: Sortable_Category_Pill_Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`Services_category${isActive ? ' active' : ''}`}
      onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <Category_Pill_Body category={category} isEditMode={isEditMode} onDelete={onDelete} />
    </div>
  );
};

interface Service_Card_Body_Props {
  service: Service;
  isEditMode: boolean;
  onEdit: () => void;
  onToggleFavorite: () => void;
}

const Service_Card_Body = ({ service, isEditMode, onEdit, onToggleFavorite }: Service_Card_Body_Props) => (
  <>
    <button
      className={`Services_service_favorite${service.isFavorite ? ' active' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite();
      }}
    >
      <Icon.Star filled={service.isFavorite} />
    </button>

    <div className='Services_service_abbreviation' style={{ backgroundColor: service.color }}>
      {service.abbreviation}
    </div>
    <div className='Services_service_info'>
      <span className='Services_service_name'>{service.name}</span>
      <span className='Services_service_url'>{service.link}</span>
    </div>

    {isEditMode && (
      <button
        className='Services_service_edit'
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Icon.Pencil />
      </button>
    )}
  </>
);

interface Static_Service_Card_Props {
  service: Service;
  isEditMode: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
}

const Static_Service_Card = ({ service, isEditMode, onOpen, onEdit, onToggleFavorite }: Static_Service_Card_Props) => (
  <div className='Services_service' onClick={() => !isEditMode && onOpen()}>
    <Service_Card_Body service={service} isEditMode={isEditMode} onEdit={onEdit} onToggleFavorite={onToggleFavorite} />
  </div>
);

interface Sortable_Service_Card_Props extends Static_Service_Card_Props {
  disabled: boolean;
}

const Sortable_Service_Card = ({
  service,
  isEditMode,
  disabled,
  onOpen,
  onEdit,
  onToggleFavorite,
}: Sortable_Service_Card_Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className='Services_service'
      onClick={() => !isEditMode && onOpen()}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <Service_Card_Body service={service} isEditMode={isEditMode} onEdit={onEdit} onToggleFavorite={onToggleFavorite} />
    </div>
  );
};

interface Droppable_Category_Group_Props {
  id: string;
  children: React.ReactNode;
}

const Droppable_Category_Group = ({ id, children }: Droppable_Category_Group_Props) => {
  const { setNodeRef } = useDroppable({ id: `category-drop-${id}` });
  return (
    <div className='Services_list_services' ref={setNodeRef}>
      {children}
    </div>
  );
};

type Hosting_Filter = 'ALL' | ServiceHosting;

const HOSTING_FILTERS: { value: Hosting_Filter; labelKey: string }[] = [
  { value: 'ALL', labelKey: 'services:page.all' },
  ...SERVICE_HOSTING_OPTIONS,
];

const serviceCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const collisions = pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  const firstCollision = getFirstCollision(collisions, 'id');
  return firstCollision != null ? [{ id: firstCollision }] : [];
};

const Services = () => {
  const { t } = useTranslation('services');
  const { categories, loading: loadingCategories, fetchCategories } = useCategories();
  const { deleteCategory, reorderCategories } = useCategory();
  const { updateService, reorderServices } = useService();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hostingFilter, setHostingFilter] = useState<Hosting_Filter>('ALL');
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [pendingDeletedCategoryIds, setPendingDeletedCategoryIds] = useState<Set<string>>(new Set());
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [addServiceCategoryId, setAddServiceCategoryId] = useState<string | null>(null);

  const [localCategories, setLocalCategories] = useState<CategoryWithServices[]>(categories);
  const [activeCategoryPill, setActiveCategoryPill] = useState<CategoryWithServices | null>(null);
  const [activeServiceCard, setActiveServiceCard] = useState<Service | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const isSearching = searchQuery.trim() !== '';

  const isFiltering = isSearching || hostingFilter !== 'ALL';

  const matchesFilters = (service: Service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (hostingFilter === 'ALL' || service.hosting === hostingFilter);

  const totalServicesCount = localCategories.reduce((sum, category) => sum + category.services.length, 0);

  const visibleCategories = (selectedCategoryId
    ? localCategories.filter((category) => category.id === selectedCategoryId)
    : localCategories
  )
    .map((category) => ({
      ...category,
      services: category.services.filter(matchesFilters),
    }))
    .filter((category) => (isFiltering ? category.services.length > 0 : isEditMode || category.services.length > 0));

  const favoriteServices = localCategories
    .flatMap((category) => category.services)
    .filter((service) => service.isFavorite && matchesFilters(service));

  const handleDeleteCategory = (id: string) => {
    setPendingDeletedCategoryIds((prev) => new Set(prev).add(id));
    setLocalCategories((prev) => prev.filter((category) => category.id !== id));
    if (selectedCategoryId === id) setSelectedCategoryId(null);
  };

  const handleEnterEditMode = () => {
    setLocalCategories(categories);
    setPendingDeletedCategoryIds(new Set());
    setIsEditMode(true);
  };

  const handleCancelEdits = () => {
    setLocalCategories(categories);
    setPendingDeletedCategoryIds(new Set());
    setIsEditMode(false);
  };

  const handleSaveEdits = async () => {
    setSavingEdits(true);
    try {
      for (const id of pendingDeletedCategoryIds) {
        await deleteCategory(id);
      }

      const survivingCategories = localCategories.filter((category) => !pendingDeletedCategoryIds.has(category.id));

      const originalServiceCategoryId = new Map(
        categories.flatMap((category) => category.services.map((service) => [service.id, category.id]))
      );

      for (const category of survivingCategories) {
        for (const service of category.services) {
          if (originalServiceCategoryId.get(service.id) !== category.id) {
            await updateService(service.id, { categoryId: category.id }, true);
          }
        }
      }

      await reorderCategories(survivingCategories.map((category) => category.id));

      for (const category of survivingCategories) {
        await reorderServices(category.id, category.services.map((service) => service.id));
      }

      setPendingDeletedCategoryIds(new Set());
      setIsEditMode(false);
      fetchCategories();
    } finally {
      setSavingEdits(false);
    }
  };

  const handleToggleFavorite = async (service: Service) => {
    const success = await updateService(service.id, { isFavorite: !service.isFavorite }, true);
    if (success) fetchCategories();
  };

  const handleCategoryDragStart = (event: DragStartEvent) => {
    const category = localCategories.find((c) => c.id === event.active.id) ?? null;
    setActiveCategoryPill(category);
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    setActiveCategoryPill(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex((category) => category.id === active.id);
    const newIndex = localCategories.findIndex((category) => category.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setLocalCategories(arrayMove(localCategories, oldIndex, newIndex));
  };

  const handleServiceDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const service = localCategories.flatMap((category) => category.services).find((s) => s.id === id) ?? null;
    setActiveServiceCard(service);
  };

  const handleServiceDragEnd = (event: DragEndEvent) => {
    setActiveServiceCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceCategory = localCategories.find((category) => category.services.some((service) => service.id === activeId));
    if (!sourceCategory) return;

    let destinationCategoryId: string;
    let destinationIndex: number | null = null;

    if (overId.startsWith('category-drop-')) {
      destinationCategoryId = overId.replace('category-drop-', '');
    } else {
      const destinationCategory = localCategories.find((category) =>
        category.services.some((service) => service.id === overId)
      );
      if (!destinationCategory) return;
      destinationCategoryId = destinationCategory.id;
      destinationIndex = destinationCategory.services.findIndex((service) => service.id === overId);
    }

    if (destinationCategoryId === sourceCategory.id) {
      const oldIndex = sourceCategory.services.findIndex((service) => service.id === activeId);
      if (destinationIndex === null || oldIndex === destinationIndex) return;

      const newServices = arrayMove(sourceCategory.services, oldIndex, destinationIndex);
      setLocalCategories((prev) =>
        prev.map((category) => (category.id === sourceCategory.id ? { ...category, services: newServices } : category))
      );
      return;
    }

    const movingService = sourceCategory.services.find((service) => service.id === activeId);
    if (!movingService) return;

    const remainingSource = sourceCategory.services.filter((service) => service.id !== activeId);
    const destinationServices = localCategories.find((category) => category.id === destinationCategoryId)?.services ?? [];
    const insertAt = destinationIndex ?? destinationServices.length;
    const newDestinationServices = [
      ...destinationServices.slice(0, insertAt),
      { ...movingService, categoryId: destinationCategoryId },
      ...destinationServices.slice(insertAt),
    ];

    setLocalCategories((prev) =>
      prev.map((category) => {
        if (category.id === sourceCategory.id) return { ...category, services: remainingSource };
        if (category.id === destinationCategoryId) return { ...category, services: newDestinationServices };
        return category;
      })
    );
  };

  return (
    <div className='Services'>
      <header>
        <div className="Right_Side">
          <span>{t('page.title')}</span>
          <Page_Help topic='shortcuts' />
        </div>
        <div className="Left_Side">
          <div className="Input_field">
            <Global_Input
              id="services-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('page.searchPlaceholder')}
            />
          </div>

          <div className="Services_create">
            <button onClick={() => setIsCreateMenuOpen((value) => !value)}>
              <Icon.Plus />
            </button>

            {isCreateMenuOpen && (
              <>
                <div className="Services_create_overlay" onClick={() => setIsCreateMenuOpen(false)}></div>
                <div className="Services_create_menu">
                  <div
                    onClick={() => {
                      setIsAddCategoryOpen(true);
                      setIsCreateMenuOpen(false);
                    }}
                  >
                    {t('page.newCategory')}
                  </div>
                  <div
                    className={categories.length === 0 ? 'disabled' : ''}
                    onClick={() => {
                      if (categories.length === 0) return;
                      setAddServiceCategoryId(categories[0].id);
                      setIsCreateMenuOpen(false);
                    }}
                  >
                    {t('page.newService')}
                  </div>
                </div>
              </>
            )}
          </div>

          {isEditMode ? (
            <>
              <button onClick={handleCancelEdits} disabled={savingEdits}>
                <span>{t('common:actions.cancel')}</span>
              </button>
              <button className="active" onClick={handleSaveEdits} disabled={savingEdits}>
                <span>{t('common:actions.save')}</span>
              </button>
            </>
          ) : (
            <button onClick={handleEnterEditMode}>
              <Icon.Pencil />
              <span>{t('common:actions.edit')}</span>
            </button>
          )}
        </div>
      </header>

      <Page_Intro page='services' />

      <div className='Services_hosting'>
        <span className='Services_hosting_label'>{t('page.hosting')}</span>

        <div className='Services_hosting_options'>
          {HOSTING_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type='button'
              className={hostingFilter === filter.value ? 'active' : ''}
              onClick={() => setHostingFilter(filter.value)}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleCategoryDragStart}
        onDragEnd={handleCategoryDragEnd}
        onDragCancel={() => setActiveCategoryPill(null)}
      >
        <div className='Services_categories'>
          <div
            className={`Services_category Services_category_all${selectedCategoryId === null ? ' active' : ''}`}
            onClick={() => setSelectedCategoryId(null)}
          >
            <span className='Services_category_name'>{t('page.all')}</span>
            <span className='Services_category_count'>{totalServicesCount}</span>
          </div>

          <SortableContext items={localCategories.map((category) => category.id)} strategy={rectSortingStrategy}>
            {localCategories.map((category) => (
              <Sortable_Category_Pill
                key={category.id}
                category={category}
                isActive={selectedCategoryId === category.id}
                isEditMode={isEditMode}
                disabled={!isEditMode}
                onSelect={() => setSelectedCategoryId(category.id)}
                onDelete={() => handleDeleteCategory(category.id)}
              />
            ))}
          </SortableContext>

          {isEditMode && (
            <div
              className='Services_category Services_category_add'
              onClick={() => setIsAddCategoryOpen(true)}
            >
              <Icon.Plus />
              <span className='Services_category_name'>{t('page.newCategory')}</span>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeCategoryPill && (
            <div className='Services_category_overlay'>
              <Category_Pill_Body category={activeCategoryPill} isEditMode={false} onDelete={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <DndContext
        sensors={sensors}
        collisionDetection={serviceCollisionDetection}
        onDragStart={handleServiceDragStart}
        onDragEnd={handleServiceDragEnd}
        onDragCancel={() => setActiveServiceCard(null)}
      >
        <div className='Services_list'>
          {!loadingCategories && categories.length === 0 && (
            <Empty_State
              title={t('empty.title')}
              text={t('empty.text')}
              actionLabel={t('empty.action')}
              onAction={() => setIsAddCategoryOpen(true)}
            />
          )}
          {selectedCategoryId === null && favoriteServices.length > 0 && (
            <div className='Services_list_group'>
              <div className='Services_list_header'>
                <span className='Services_list_title Services_list_title_favorites'>{t('page.favorites')}</span>
                <span className='Services_list_count'>{favoriteServices.length}</span>
                <div className='Services_list_separator'></div>
              </div>

              <div className='Services_list_services'>
                {favoriteServices.map((service) => (
                  <Static_Service_Card
                    key={service.id}
                    service={service}
                    isEditMode={isEditMode}
                    onOpen={() => window.open(service.link, '_blank', 'noopener,noreferrer')}
                    onEdit={() => setEditingService(service)}
                    onToggleFavorite={() => handleToggleFavorite(service)}
                  />
                ))}
              </div>
            </div>
          )}

          {visibleCategories.map((category) => (
            <div className='Services_list_group' key={category.id}>
              <div className='Services_list_header'>
                <span className='Services_list_title'>{category.name}</span>
                <span className='Services_list_count'>{category.services.length}</span>
                <div className='Services_list_separator'></div>
              </div>

              <SortableContext items={category.services.map((service) => service.id)} strategy={rectSortingStrategy}>
                <Droppable_Category_Group id={category.id}>
                  {category.services.map((service) => (
                    <Sortable_Service_Card
                      key={service.id}
                      service={service}
                      isEditMode={isEditMode}
                      disabled={!isEditMode || isFiltering}
                      onOpen={() => window.open(service.link, '_blank', 'noopener,noreferrer')}
                      onEdit={() => setEditingService(service)}
                      onToggleFavorite={() => handleToggleFavorite(service)}
                    />
                  ))}
                </Droppable_Category_Group>
              </SortableContext>

              {isEditMode && (
                <div
                  className='Services_service_add'
                  onClick={() => setAddServiceCategoryId(category.id)}
                >
                  <Icon.Plus />
                  <span>{t('page.newService')}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeServiceCard && (
            <div className='Services_service_overlay'>
              <Service_Card_Body
                service={activeServiceCard}
                isEditMode={false}
                onEdit={() => {}}
                onToggleFavorite={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {editingService && (
        <Service_Edit_Modal
          service={editingService}
          categories={categories}
          onClose={() => setEditingService(null)}
          onSaved={() => {
            setEditingService(null);
            fetchCategories();
          }}
        />
      )}

      {isAddCategoryOpen && (
        <Category_Add_Modal
          onClose={() => setIsAddCategoryOpen(false)}
          onSaved={() => {
            setIsAddCategoryOpen(false);
            fetchCategories();
          }}
        />
      )}

      {addServiceCategoryId && (
        <Service_Add_Modal
          categories={categories}
          defaultCategoryId={addServiceCategoryId}
          onClose={() => setAddServiceCategoryId(null)}
          onSaved={() => {
            setAddServiceCategoryId(null);
            fetchCategories();
          }}
        />
      )}
    </div>
  )
};

export default Services;
